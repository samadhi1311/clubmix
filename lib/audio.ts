import { guess } from 'web-audio-beat-detector';
import * as Tone from 'tone';

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
