/**
 * Type definitions for audio-related data structures
 */

export interface Track {
	id: string;
	file: File;
	name: string;
	duration: number;
	bpm: number;
	key: string;
	waveformData: number[];
}

export interface BeatInfo {
	position: number; // In seconds
	confidence: number; // 0-1 indicating confidence level
	isMeasureStart: boolean; // True if this is the start of a measure
}

export interface AudioData {
	buffer: AudioBuffer;
	waveform: number[]; // Normalized waveform data for visualization
	bpm: number;
	key: string;
	beats: BeatInfo[];
	duration: number;
}

export interface TransitionConfig {
	// Transition duration in beats
	durationBeats: number;

	// EQ mixing settings
	eqMixing: boolean;
	lowCrossfadeDuration: number; // In beats
	midCrossfadeDuration: number; // In beats
	highCrossfadeDuration: number; // In beats

	// Crossfade curve type
	fadeCurve: 'linear' | 'exponential' | 'sigmoid';

	// BPM and key matching
	bpmMatching: boolean;
	keyMatching: boolean;
}
