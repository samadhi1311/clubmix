import { guess } from 'web-audio-beat-detector';

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
