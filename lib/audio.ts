import { guess } from 'web-audio-beat-detector';
import * as Tone from 'tone';

declare module 'tone' {
	interface Player {
		startTime?: number;
	}
}

export const detectBPM = async (buffer: AudioBuffer) => {
	try {
		const { bpm, offset } = await guess(buffer);
		return { bpm: Math.round(bpm * 10) / 10, offset: offset };
	} catch (error) {
		console.error('Error analyzing audio:', error);
		return { bpm: 0, offset: 0 };
	}
};

const normalizeData = (data: Float32Array): Float32Array => {
	let max = 0;
	for (let i = 0; i < data.length; i++) {
		const amplitude = Math.abs(data[i]);
		if (amplitude > max) max = amplitude;
	}

	const result = new Float32Array(data.length);
	for (let i = 0; i < data.length; i++) {
		result[i] = max === 0 ? 0 : data[i] / max;
	}

	return result;
};

const lowPassFilter = (data: Float32Array, sampleRate: number): Float32Array => {
	const result = new Float32Array(data.length);
	const alpha = 0.03;
	const resonance = 1.5;
	let prevValue = 0;

	result[0] = data[0];
	for (let i = 1; i < data.length; i++) {
		const filtered = alpha * data[i] + (1 - alpha) * result[i - 1];
		result[i] = filtered + resonance * (filtered - prevValue);
		prevValue = filtered;
	}

	return result;
};

export const detectBeats = (audioBuffer: AudioBuffer, bpm: number, offset: number): number[] => {
	try {
		const sampleRate = audioBuffer.sampleRate;
		const data = audioBuffer.getChannelData(0);
		const normalizedData = normalizeData(data);
		const filteredData = lowPassFilter(normalizedData, sampleRate);

		const secondsPerBeat = 60 / bpm;
		const samplesPerBeat = secondsPerBeat * sampleRate;

		const energyWindow = Math.floor(samplesPerBeat / 4);
		const energyData = new Float32Array(Math.floor(data.length / energyWindow));

		for (let i = 0; i < energyData.length; i++) {
			let energy = 0;
			const startIdx = i * energyWindow;
			const endIdx = Math.min(startIdx + energyWindow, data.length);

			for (let j = startIdx; j < endIdx; j++) {
				energy += Math.abs(filteredData[j]);
			}

			energyData[i] = energy / energyWindow;
		}

		const beats: number[] = [];
		const minPeakDistance = Math.floor(samplesPerBeat / energyWindow) * 0.9;

		let averageEnergy = 0;
		for (let i = 0; i < Math.min(energyData.length, 100); i++) {
			averageEnergy += energyData[i];
		}
		averageEnergy /= Math.min(energyData.length, 100);

		const dynamicThreshold = averageEnergy * 1.5;

		let lastPeakIndex = -minPeakDistance * 2;
		for (let i = 1; i < energyData.length - 1; i++) {
			if (energyData[i] > dynamicThreshold && energyData[i] > energyData[i - 1] && energyData[i] >= energyData[i + 1] && i - lastPeakIndex > minPeakDistance) {
				const beatTime = (i * energyWindow) / sampleRate;
				beats.push(beatTime);
				lastPeakIndex = i;
			}
		}

		if (beats.length < 4) {
			console.log('Beat detection ineffective, falling back to calculated beats');
			beats.length = 0;
			const numBeats = Math.floor(data.length / samplesPerBeat);
			for (let i = 0; i < numBeats; i++) {
				beats.push(offset + i * secondsPerBeat);
			}
		}

		if (beats.length > 0 && beats[0] < offset) {
			const beatAdjustment = offset - beats[0];
			for (let i = 0; i < beats.length; i++) {
				beats[i] += beatAdjustment;
			}
		}

		return beats;
	} catch (error) {
		console.error('Error detecting beats:', error);
		const secondsPerBeat = 60 / bpm;
		const audioDuration = audioBuffer.duration;
		const numBeats = Math.floor(audioDuration / secondsPerBeat);

		const beats: number[] = [];
		for (let i = 0; i < numBeats; i++) {
			beats.push(offset + i * secondsPerBeat);
		}
		return beats;
	}
};

export const applyCrossfade = (player1: Tone.Player | null, player2: Tone.Player | null, value: number): void => {
	if (!player1 || !player2) return;

	try {
		const logValue = Math.pow(value, 2);

		const volume1 = value <= 0.5 ? 1 : Math.cos((logValue - 0.5) * Math.PI);
		const volume2 = value >= 0.5 ? 1 : Math.cos((0.5 - logValue) * Math.PI);

		if (player1.volume) {
			try {
				const db1 = volume1 <= 0.001 ? -Infinity : Tone.gainToDb(Math.max(0.001, volume1));
				player1.volume.value = db1;
			} catch (e) {
				console.error('Error setting volume on player 1:', e);
			}
		}

		if (player2.volume) {
			try {
				const db2 = volume2 <= 0.001 ? -Infinity : Tone.gainToDb(Math.max(0.001, volume2));
				player2.volume.value = db2;
			} catch (e) {
				console.error('Error setting volume on player 2:', e);
			}
		}
	} catch (error) {
		console.error('Error applying crossfade:', error);
	}
};

// Helper to get current playback position of a player without accessing private properties
const getPlayerCurrentTime = (player: Tone.Player): number => {
	if (player.state !== 'started') return 0;

	const now = Tone.now();
	return player.startTime !== undefined ? now - player.startTime : 0;
};

export const automaticTransition = (
	player1: Tone.Player,
	player2: Tone.Player,
	bpm1: number,
	bpm2: number,
	beats1: number[],
	beats2: number[],
	startTime: number,
	transitionBeats: number = 16
): void => {
	console.log('Starting automatic transition', { bpm1, bpm2 });

	try {
		const transport = Tone.getTransport();
		const player1CurrentTime = getPlayerCurrentTime(player1);
		const currentTime = transport.seconds - startTime + player1CurrentTime;

		let currentBeatIndex = 0;
		for (let i = 0; i < beats1.length; i++) {
			if (beats1[i] > currentTime) {
				currentBeatIndex = i;
				break;
			}
		}

		if (currentBeatIndex + transitionBeats >= beats1.length) {
			currentBeatIndex = Math.max(0, beats1.length - transitionBeats - 1);
		}

		const startTransitionTime = beats1[currentBeatIndex];
		const endTransitionTime = beats1[currentBeatIndex + transitionBeats];
		const transitionDuration = endTransitionTime - startTransitionTime;

		const updateIntervalMs = 50;
		const totalUpdates = Math.max(10, Math.floor((transitionDuration * 1000) / updateIntervalMs));

		const scheduleTime = startTime + startTransitionTime - player1CurrentTime;

		console.log('Transition details:', {
			currentBeatIndex,
			startTransitionTime,
			endTransitionTime,
			transitionDuration,
			scheduleTime,
		});

		const secondTrackOffset = beats2[0] || 0;

		let currentUpdate = 0;
		let previousRateRatio = bpm1 / bpm2;

		player1.volume.value = 0;
		player2.volume.value = -Infinity;
		player1.playbackRate = 1;
		player2.playbackRate = bpm1 / bpm2;

		transport.schedule((time) => {
			console.log('Starting player2 at offset:', secondTrackOffset);
			player2.start(time, secondTrackOffset);

			const updateInterval = setInterval(() => {
				currentUpdate++;
				const progress = Math.min(1, currentUpdate / totalUpdates);

				applyCrossfade(player1, player2, progress);

				const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);

				const rate1 = 1 - (1 - bpm2 / bpm1) * easedProgress;
				const rate2 = previousRateRatio + (1 - previousRateRatio) * easedProgress;

				const maxRateChange = 0.02;
				player1.playbackRate = Math.max(0.5, Math.min(2, player1.playbackRate + Math.min(maxRateChange, Math.max(-maxRateChange, rate1 - player1.playbackRate))));
				player2.playbackRate = Math.max(0.5, Math.min(2, player2.playbackRate + Math.min(maxRateChange, Math.max(-maxRateChange, rate2 - player2.playbackRate))));

				transport.bpm.value = bpm1 + (bpm2 - bpm1) * easedProgress;

				if (progress >= 1) {
					clearInterval(updateInterval);
					player1.stop();
					player2.volume.value = 0;
					player2.playbackRate = 1;
					transport.bpm.value = bpm2;
					console.log('Transition completed');
				}
			}, updateIntervalMs);
		}, scheduleTime);
	} catch (error) {
		console.error('Error in automatic transition:', error);
	}
};

export const eqTransition = (player1: Tone.Player, player2: Tone.Player, bpm1: number, bpm2: number, beats1: number[], beats2: number[], startTime: number, transitionBeats: number = 16): void => {
	try {
		const lowEQ1 = new Tone.Filter(250, 'lowpass').toDestination();
		const highEQ1 = new Tone.Filter(250, 'highpass').toDestination();
		const lowEQ2 = new Tone.Filter(250, 'lowpass').toDestination();
		const highEQ2 = new Tone.Filter(250, 'highpass').toDestination();

		player1.disconnect();
		player2.disconnect();

		player1.connect(lowEQ1);
		player1.connect(highEQ1);
		player2.connect(lowEQ2);
		player2.connect(highEQ2);

		lowEQ1.Q.value = 1;
		highEQ1.Q.value = 1;
		lowEQ2.Q.value = 1;
		highEQ2.Q.value = 1;

		const transport = Tone.getTransport();
		const player1CurrentTime = getPlayerCurrentTime(player1);
		const currentTime = transport.seconds - startTime + player1CurrentTime;

		let currentBeatIndex = 0;
		for (let i = 0; i < beats1.length; i++) {
			if (beats1[i] > currentTime) {
				currentBeatIndex = i;
				break;
			}
		}

		const startTransitionTime = beats1[currentBeatIndex];
		const endTransitionTime = beats1[currentBeatIndex + transitionBeats];
		const transitionDuration = endTransitionTime - startTransitionTime;
		const updateIntervalMs = 50;
		const totalUpdates = (transitionDuration * 1000) / updateIntervalMs;

		const secondTrackOffset = beats2[0] || 0;
		transport.schedule((time) => {
			player2.start(time, secondTrackOffset);

			player1.volume.value = 0;
			player2.volume.value = 0;
			player1.playbackRate = 1;
			player2.playbackRate = bpm1 / bpm2;

			lowEQ1.frequency.value = 1000;
			highEQ1.frequency.value = 0;
			lowEQ2.frequency.value = 0;
			highEQ2.frequency.value = 1000;

			let currentUpdate = 0;

			const updateInterval = setInterval(() => {
				currentUpdate++;
				const progress = Math.min(1, currentUpdate / totalUpdates);
				const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);

				const rate1 = 1 - (1 - bpm2 / bpm1) * easedProgress;
				const rate2 = bpm1 / bpm2 + (1 - bpm1 / bpm2) * easedProgress;

				player1.playbackRate = rate1;
				player2.playbackRate = rate2;

				const bassCrossover = 250 + 750 * easedProgress;
				const midCrossover = 1000 + 4000 * easedProgress;

				lowEQ1.frequency.value = bassCrossover;
				highEQ1.frequency.value = progress > 0.5 ? midCrossover : 0;

				lowEQ2.frequency.value = progress < 0.5 ? 0 : bassCrossover;
				highEQ2.frequency.value = midCrossover;

				transport.bpm.value = bpm1 + (bpm2 - bpm1) * easedProgress;

				if (progress >= 1) {
					clearInterval(updateInterval);

					player1.stop();
					player1.disconnect();
					player2.disconnect();

					lowEQ1.dispose();
					highEQ1.dispose();
					lowEQ2.dispose();
					highEQ2.dispose();

					player2.toDestination();
					player2.volume.value = 0;
					player2.playbackRate = 1;
					transport.bpm.value = bpm2;
				}
			}, updateIntervalMs);
		}, startTime + (startTransitionTime - player1CurrentTime));
	} catch (error) {
		console.error('Error in EQ transition:', error);
	}
};
