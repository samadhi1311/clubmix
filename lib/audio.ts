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
