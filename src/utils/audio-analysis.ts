/**
 * Functions for audio analysis, beat detection, and BPM estimation
 */

import FFT from 'fft.js';

/**
 * Detect the BPM (beats per minute) of an audio track using energy envelope + FFT
 *
 * @param audioData The raw audio data as a Float32Array
 * @param sampleRate The sample rate of the audio (e.g., 44100)
 * @returns The estimated BPM (beats per minute)
 */
export const detectBPM = (audioData: Float32Array, sampleRate: number): number => {
	const windowSize = Math.floor(sampleRate * 0.05); // 50ms
	const hopSize = Math.floor(windowSize / 2);
	const numFrames = Math.floor((audioData.length - windowSize) / hopSize);

	// Step 1: Calculate short-time energy
	const energy = new Float32Array(numFrames);
	for (let i = 0; i < numFrames; i++) {
		let sum = 0;
		for (let j = 0; j < windowSize; j++) {
			const idx = i * hopSize + j;
			sum += audioData[idx] * audioData[idx];
		}
		energy[i] = sum;
	}

	// Normalize
	const max = Math.max(...energy);
	for (let i = 0; i < energy.length; i++) energy[i] /= max;

	// Remove DC
	const mean = energy.reduce((a, b) => a + b, 0) / energy.length;
	for (let i = 0; i < energy.length; i++) energy[i] -= mean;

	// Step 2: FFT analysis on energy envelope
	const fftSize = 1 << Math.ceil(Math.log2(energy.length));
	const fft = new FFT(fftSize);
	const input = new Array(fftSize).fill(0);
	const output = fft.createComplexArray();

	for (let i = 0; i < energy.length; i++) input[i] = energy[i];

	fft.realTransform(output, input);
	fft.completeSpectrum(output);

	const magnitudes = new Float32Array(fftSize / 2);
	for (let i = 0; i < fftSize / 2; i++) {
		const re = output[2 * i];
		const im = output[2 * i + 1];
		magnitudes[i] = Math.sqrt(re * re + im * im);
	}

	// Step 3: Detect dominant periodicity in BPM range
	const minBPM = 60;
	const maxBPM = 185;
	const binFreq = sampleRate / hopSize / fftSize;

	let maxMag = 0;
	let peakIndex = 0;
	for (let i = 1; i < magnitudes.length; i++) {
		const freq = i * binFreq;
		const bpm = freq * 60;
		if (bpm >= minBPM && bpm <= maxBPM) {
			if (magnitudes[i] > maxMag) {
				maxMag = magnitudes[i];
				peakIndex = i;
			}
		}
	}

	const peakFreq = peakIndex * binFreq;
	const bpm = peakFreq * 60;

	return Math.round(bpm * 10) / 10;
};

/**
 * Find beat positions in an audio track based on detected BPM
 *
 * @param audioData The raw audio data as a Float32Array
 * @param sampleRate The sample rate of the audio (e.g., 44100)
 * @param bpm The detected BPM (beats per minute)
 * @returns An array of beat positions in seconds
 */
export const findBeats = (audioData: Float32Array, sampleRate: number, bpm: number): number[] => {
	const beatPeriod = 60 / bpm;
	const windowSize = Math.floor(sampleRate * 0.05); // 50ms
	const hopSize = Math.floor(windowSize / 2);
	const numFrames = Math.floor((audioData.length - windowSize) / hopSize);

	// Step 1: Compute energy envelope
	const envelope = new Float32Array(numFrames);
	for (let i = 0; i < numFrames; i++) {
		let sum = 0;
		const offset = i * hopSize;
		for (let j = 0; j < windowSize; j++) {
			const idx = offset + j;
			const sample = audioData[idx] || 0;
			sum += sample * sample;
		}
		envelope[i] = sum;
	}

	// Normalize
	const maxEnergy = Math.max(...envelope);
	for (let i = 0; i < envelope.length; i++) envelope[i] /= maxEnergy;

	// Step 2: Peak detection
	const peaks: number[] = [];
	for (let i = 1; i < envelope.length - 1; i++) {
		if (envelope[i] > envelope[i - 1] && envelope[i] >= envelope[i + 1] && envelope[i] > 0.3) {
			peaks.push(i);
		}
	}

	if (peaks.length === 0) return [];

	// Step 3: Snap peaks to beat grid using dynamic programming
	const beatFrames: number[] = [];
	const beatHop = (beatPeriod * sampleRate) / hopSize;
	let frame = peaks[0];

	while (frame < numFrames) {
		let bestPeak = frame;
		let bestScore = 0;

		for (let i = 0; i < peaks.length; i++) {
			const dist = Math.abs(peaks[i] - frame);
			if (dist < beatHop / 2) {
				const score = 1 / (1 + dist); // Closer peaks are better
				if (score > bestScore) {
					bestScore = score;
					bestPeak = peaks[i];
				}
			}
		}

		beatFrames.push(bestPeak);
		frame += beatHop;
	}

	// Convert to seconds
	const beats = beatFrames.map((f) => (f * hopSize) / sampleRate);
	return beats;
};

/**
 * Analyze an audio buffer to find phrase boundaries
 *
 * @param audioData The raw audio data as a Float32Array
 * @param sampleRate The sample rate of the audio (e.g., 44100)
 * @param beats An array of beat positions in seconds
 * @returns An array of phrase positions in seconds
 */
export const findPhrases = (audioData: Float32Array, sampleRate: number, beats: number[], phraseLength: number = 16): number[] => {
	if (beats.length < phraseLength) return [];

	const phrases: number[] = [];
	const phraseEnergies: number[] = [];

	for (let i = 0; i + phraseLength < beats.length; i += phraseLength) {
		const startTime = beats[i];
		const endTime = beats[i + phraseLength];

		const startSample = Math.floor(startTime * sampleRate);
		const endSample = Math.floor(endTime * sampleRate);
		let sum = 0;

		for (let j = startSample; j < endSample; j++) {
			const sample = audioData[j] || 0;
			sum += sample * sample;
		}

		const avgEnergy = sum / (endSample - startSample);
		phraseEnergies.push(avgEnergy);
	}

	// Normalize phrase energies
	const max = Math.max(...phraseEnergies);
	for (let i = 0; i < phraseEnergies.length; i++) {
		phraseEnergies[i] /= max;
	}

	// Add phrase start if contrast is high or it's the first
	for (let i = 0; i < phraseEnergies.length; i++) {
		if (i === 0 || phraseEnergies[i] > phraseEnergies[i - 1] * 1.2) {
			phrases.push(beats[i * phraseLength]);
		}
	}

	return phrases;
};

/**
 * Find the first strong downbeat in the audio
 *
 * @param audioData The raw audio data as a Float32Array
 * @param sampleRate The sample rate of the audio
 * @param beats Array of beat positions in seconds
 * @returns The time in seconds of the first downbeat
 */
export const findFirstDownbeat = (audioData: Float32Array, sampleRate: number, beats: number[]): number => {
	if (beats.length < 4) return 0;

	const windowSize = Math.floor(sampleRate * 0.05); // 50ms window
	const energies: number[] = [];

	// Calculate energy for each beat
	for (const beat of beats.slice(0, 16)) {
		// Look at first 16 beats
		const startSample = Math.floor(beat * sampleRate);
		let energy = 0;

		// Calculate energy in the window after each beat
		for (let i = 0; i < windowSize; i++) {
			const idx = startSample + i;
			if (idx < audioData.length) {
				energy += audioData[idx] * audioData[idx];
			}
		}
		energies.push(energy);
	}

	// Normalize energies
	const maxEnergy = Math.max(...energies);
	const normalizedEnergies = energies.map((e) => e / maxEnergy);

	// Find first strong beat (threshold at 0.5)
	const strongBeatIndex = normalizedEnergies.findIndex((e) => e > 0.5);

	// If no strong beat found, return first beat
	if (strongBeatIndex === -1) return beats[0];

	// Return the time of the first strong beat
	return beats[strongBeatIndex];
};
