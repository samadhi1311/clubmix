import { useState, useEffect, useRef } from 'react';
import { detectBPM, findBeats, findFirstDownbeat } from '../utils/audio-analysis';

interface AudioProcessingProps {
	transitionBeats: number;
	masterVolume: number;
	onTransitionComplete: () => void;
}

export const useAudioProcessing = ({ transitionBeats, masterVolume, onTransitionComplete }: AudioProcessingProps) => {
	// Main audio context
	const audioContextRef = useRef<AudioContext | null>(null);

	// Audio nodes for each deck
	const audioNodesRef = useRef<{
		[key: string]: {
			source?: AudioBufferSourceNode;
			gainNode?: GainNode;
			analyzerNode?: AnalyserNode;
			buffer?: AudioBuffer;
		};
	}>({
		deck1: {},
		deck2: {},
	});

	// Track audio data
	const audioDataRef = useRef<{
		[key: string]: {
			buffer?: AudioBuffer;
			bpm: number;
			beats: number[];
			firstDownbeat: number;
			isPlaying: boolean;
			startTime: number;
			pauseTime: number;
			playbackRate: number;
		};
	}>({
		deck1: { bpm: 0, beats: [], firstDownbeat: 0, isPlaying: false, startTime: 0, pauseTime: 0, playbackRate: 1 },
		deck2: { bpm: 0, beats: [], firstDownbeat: 0, isPlaying: false, startTime: 0, pauseTime: 0, playbackRate: 1 },
	});

	// Mixing state
	const [isMixing, setIsMixing] = useState<boolean>(false);
	const mixingStateRef = useRef<{
		isTransitioning: boolean;
		fromDeck: string;
		toDeck: string;
		transitionStartTime: number;
		transitionDuration: number;
		initialBPM: number;
		targetBPM: number;
	}>({
		isTransitioning: false,
		fromDeck: '',
		toDeck: '',
		transitionStartTime: 0,
		transitionDuration: 0,
		initialBPM: 0,
		targetBPM: 0,
	});

	// Analyzer data for visualization
	const [analyzerData, setAnalyzerData] = useState<{
		[key: string]: {
			waveform: number[];
			beatPositions: number[];
		};
	}>({
		deck1: { waveform: [], beatPositions: [] },
		deck2: { waveform: [], beatPositions: [] },
	});

	// Playback progress
	const [progress, setProgress] = useState<{
		[key: string]: {
			position: number;
			isPlaying: boolean;
		};
	}>({
		deck1: { position: 0, isPlaying: false },
		deck2: { position: 0, isPlaying: false },
	});

	// Debug information
	const [debugInfo, setDebugInfo] = useState<any>({
		deck1: {},
		deck2: {},
		master: {},
		transition: {},
	});

	// Animation frame request ID for cleanup
	const animationFrameRef = useRef<number | null>(null);

	// Initialize audio context
	useEffect(() => {
		if (!audioContextRef.current) {
			// Create new audio context with auto-play policy
			audioContextRef.current = new window.AudioContext();

			// Resume audio context if it's suspended (needed for some browsers)
			if (audioContextRef.current.state === 'suspended') {
				audioContextRef.current.resume();
			}
		}

		// Set up update loop
		const updateLoop = () => {
			updatePlaybackInfo();
			updateTransitionState();
			animationFrameRef.current = requestAnimationFrame(updateLoop);
		};

		animationFrameRef.current = requestAnimationFrame(updateLoop);

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}

			// Clean up audio context and nodes
			Object.keys(audioNodesRef.current).forEach((deckId) => {
				const nodes = audioNodesRef.current[deckId];
				if (nodes.source) nodes.source.stop();
				if (nodes.gainNode) nodes.gainNode.disconnect();
				if (nodes.analyzerNode) nodes.analyzerNode.disconnect();
			});

			if (audioContextRef.current) {
				audioContextRef.current.close();
			}
		};
	}, []);

	// Apply master volume changes
	useEffect(() => {
		if (!audioContextRef.current) {
			const context = getOrCreateContext();
			audioContextRef.current = context;
		}

		Object.keys(audioNodesRef.current).forEach((deckId) => {
			const gainNode = audioNodesRef.current[deckId].gainNode;
			if (gainNode) {
				updateGainForDeck(deckId);
			}
		});
	}, [masterVolume]);

	// Function to load an audio track
	const loadTrack = async (file: File, deckId: string): Promise<void> => {
		if (!audioContextRef.current) {
			console.error('Audio context not initialized');
			return;
		}

		try {
			if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
				audioContextRef.current = new AudioContext();
			}
			await audioContextRef.current.resume();

			// Resume audio context if suspended
			if (audioContextRef.current.state === 'suspended') {
				await audioContextRef.current.resume();
			}

			// Read the file as an array buffer
			const arrayBuffer = await file.arrayBuffer();

			// Decode the audio data
			const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

			// Store the buffer
			audioDataRef.current[deckId].buffer = audioBuffer;
			audioNodesRef.current[deckId].buffer = audioBuffer;

			// Analyze the track
			const channelData = audioBuffer.getChannelData(0);
			const sampleRate = audioBuffer.sampleRate;

			// Detect BPM
			const bpm = detectBPM(channelData, sampleRate);
			audioDataRef.current[deckId].bpm = bpm;

			// Find beat positions
			const beats = findBeats(channelData, sampleRate, bpm);
			const firstDownbeat = findFirstDownbeat(channelData, sampleRate, beats);
			audioDataRef.current[deckId].beats = beats;
			audioDataRef.current[deckId].firstDownbeat = firstDownbeat;

			// Create waveform data
			const waveformData = createWaveformData(channelData, 1000);

			// Calculate normalized beat positions
			const beatPositions = beats.map((beatTime) => beatTime / audioBuffer.duration);

			// Update analyzer data
			setAnalyzerData((prev) => ({
				...prev,
				[deckId]: {
					waveform: waveformData,
					beatPositions,
				},
			}));

			// Update debug info
			setDebugInfo((prev) => ({
				...prev,
				[deckId]: {
					...prev[deckId],
					bpm,
					currentBpm: bpm,
					duration: audioBuffer.duration,
					beatsDetected: beats.length,
					playbackRate: 1.0,
					volume: masterVolume,
				},
			}));

			console.log(`Loaded track for ${deckId}. BPM: ${bpm}, Duration: ${audioBuffer.duration}s, Beats: ${beats.length}`);
		} catch (error) {
			console.error('Error loading track:', error);
		}
	};

	// Function to play a track
	const playTrack = (deckId: string): void => {
		if (!audioContextRef.current || !audioDataRef.current[deckId].buffer) return;

		// If already playing, stop current playback
		if (audioDataRef.current[deckId].isPlaying) {
			if (audioNodesRef.current[deckId].source) {
				audioNodesRef.current[deckId].source.stop();
			}
		}

		// Create and configure audio nodes
		const source = audioContextRef.current.createBufferSource();
		const gainNode = audioContextRef.current.createGain();
		const analyzerNode = audioContextRef.current.createAnalyser();
		analyzerNode.fftSize = 2048;

		source.buffer = audioDataRef.current[deckId].buffer;
		source.playbackRate.value = audioDataRef.current[deckId].playbackRate;
		gainNode.gain.value = masterVolume;

		// Connect nodes
		source.connect(gainNode);
		gainNode.connect(analyzerNode);
		analyzerNode.connect(audioContextRef.current.destination);

		// Save nodes
		audioNodesRef.current[deckId] = {
			source,
			gainNode,
			analyzerNode,
			buffer: audioDataRef.current[deckId].buffer,
		};

		// Calculate start time
		let startTime = 0;
		const pauseTime = audioDataRef.current[deckId].pauseTime;
		if (pauseTime > 0) {
			startTime = pauseTime + audioDataRef.current[deckId].firstDownbeat;
		} else {
			startTime = audioDataRef.current[deckId].firstDownbeat;
		}

		// Start playback with offset
		source.start(0, startTime);
		audioDataRef.current[deckId].startTime = audioContextRef.current.currentTime;
		audioDataRef.current[deckId].isPlaying = true;

		// Update states
		setProgress((prev) => ({
			...prev,
			[deckId]: {
				...prev[deckId],
				isPlaying: true,
			},
		}));

		setDebugInfo((prev) => ({
			...prev,
			[deckId]: {
				...prev[deckId],
				isPlaying: true,
			},
		}));

		// Handle track end
		source.onended = () => {
			audioDataRef.current[deckId].isPlaying = false;
			audioDataRef.current[deckId].pauseTime = 0;
			setProgress((prev) => ({
				...prev,
				[deckId]: {
					position: 0,
					isPlaying: false,
				},
			}));
		};
	};

	// Function to pause a track
	const pauseTrack = (deckId: string): void => {
		if (!audioContextRef.current || !audioDataRef.current[deckId].isPlaying) return;

		const source = audioNodesRef.current[deckId].source;
		if (source) {
			source.stop();

			// Calculate pause position
			const startTime = audioDataRef.current[deckId].startTime;
			const currentTime = audioContextRef.current.currentTime;
			const elapsedTime = (currentTime - startTime) * audioDataRef.current[deckId].playbackRate;
			audioDataRef.current[deckId].pauseTime = elapsedTime;

			// Update states
			setProgress((prev) => ({
				...prev,
				[deckId]: {
					...prev[deckId],
					isPlaying: false,
				},
			}));

			setDebugInfo((prev) => ({
				...prev,
				[deckId]: {
					...prev[deckId],
					isPlaying: false,
				},
			}));
		}
	};

	// Function to start a transition
	const startTransition = (fromDeck: string): void => {
		if (!audioContextRef.current) return;

		const toDeck = fromDeck === 'deck1' ? 'deck2' : 'deck1';

		if (!audioDataRef.current[fromDeck].buffer || !audioDataRef.current[toDeck].buffer) {
			console.error('Cannot transition: missing audio');
			return;
		}

		// Ensure both decks are playing
		if (!audioDataRef.current[fromDeck].isPlaying) {
			playTrack(fromDeck);
		}
		if (!audioDataRef.current[toDeck].isPlaying) {
			playTrack(toDeck);
		}

		// Calculate transition duration
		const fromBPM = audioDataRef.current[fromDeck].bpm;
		const toBPM = audioDataRef.current[toDeck].bpm;
		const beatsToSeconds = (beats: number, bpm: number) => (beats * 60) / bpm;
		const transitionDuration = beatsToSeconds(transitionBeats, fromBPM);

		// Set up transition state
		mixingStateRef.current = {
			isTransitioning: true,
			fromDeck,
			toDeck,
			transitionStartTime: audioContextRef.current.currentTime,
			transitionDuration,
			initialBPM: fromBPM,
			targetBPM: toBPM,
		};

		setIsMixing(true);

		// Update debug info
		setDebugInfo((prev) => ({
			...prev,
			transition: {
				fromDeck,
				toDeck,
				startTime: audioContextRef.current?.currentTime,
				durationSeconds: transitionDuration,
				durationBeats: transitionBeats,
			},
			master: {
				bpm: fromBPM,
			},
		}));
	};

	// Helper function to create waveform data
	const createWaveformData = (channelData: Float32Array, numPoints: number): number[] => {
		const blockSize = Math.floor(channelData.length / numPoints);
		const waveform = new Array(numPoints);

		for (let i = 0; i < numPoints; i++) {
			const blockStart = i * blockSize;
			let min = 0;
			let max = 0;

			for (let j = 0; j < blockSize; j++) {
				const sample = channelData[blockStart + j] || 0;
				if (sample < min) min = sample;
				if (sample > max) max = sample;
			}

			// Use peak-to-peak amplitude for better visualization
			waveform[i] = Math.max(Math.abs(min), Math.abs(max));
		}

		// Normalize
		const maxAmp = Math.max(...waveform);
		return waveform.map((w) => w / maxAmp);
	};

	// Update gain value for a deck
	const updateGainForDeck = (deckId: string): void => {
		if (!audioContextRef.current || !audioNodesRef.current[deckId].gainNode) return;

		const gainNode = audioNodesRef.current[deckId].gainNode;
		const { isTransitioning, fromDeck, toDeck, transitionStartTime, transitionDuration } = mixingStateRef.current;

		if (!isTransitioning) {
			gainNode.gain.value = masterVolume;
			return;
		}

		const now = audioContextRef.current.currentTime;
		const elapsed = now - transitionStartTime;
		const progress = Math.min(elapsed / transitionDuration, 1);

		let gain = masterVolume;
		if (deckId === fromDeck) {
			gain = masterVolume * (1 - progress);
		} else if (deckId === toDeck) {
			gain = masterVolume * progress;
		}

		gainNode.gain.linearRampToValueAtTime(gain, now + 0.01);

		setDebugInfo((prev) => ({
			...prev,
			[deckId]: {
				...prev[deckId],
				volume: gain,
			},
		}));
	};

	// Update playback rate for a deck
	const updatePlaybackRate = (deckId: string): void => {
		if (!audioContextRef.current || !audioNodesRef.current[deckId].source) return;

		const source = audioNodesRef.current[deckId].source;
		const { isTransitioning, fromDeck, toDeck, transitionStartTime, transitionDuration, initialBPM, targetBPM } = mixingStateRef.current;

		if (!isTransitioning) return;

		const now = audioContextRef.current.currentTime;
		const elapsed = now - transitionStartTime;
		const progress = Math.min(elapsed / transitionDuration, 1);

		const masterBPM = initialBPM + (targetBPM - initialBPM) * progress;
		let newRate = 1.0;

		if (deckId === fromDeck) {
			newRate = masterBPM / initialBPM;
		} else if (deckId === toDeck) {
			newRate = masterBPM / targetBPM;
		}

		newRate = Math.max(0.5, Math.min(2.0, newRate));
		source.playbackRate.linearRampToValueAtTime(newRate, now + 0.05);
		audioDataRef.current[deckId].playbackRate = newRate;

		setDebugInfo((prev) => ({
			...prev,
			[deckId]: {
				...prev[deckId],
				playbackRate: newRate,
				currentBpm: deckId === fromDeck ? initialBPM * newRate : targetBPM * newRate,
			},
			master: {
				bpm: masterBPM,
			},
		}));
	};

	// Update playback information
	const updatePlaybackInfo = (): void => {
		if (!audioContextRef.current) return;

		Object.keys(audioDataRef.current).forEach((deckId) => {
			if (!audioDataRef.current[deckId].isPlaying) return;

			const buffer = audioDataRef.current[deckId].buffer;
			if (!buffer) return;

			const startTime = audioDataRef.current[deckId].startTime;
			const currentTime = audioContextRef.current!.currentTime;
			const elapsedSeconds = (currentTime - startTime) * audioDataRef.current[deckId].playbackRate;
			const normalizedProgress = elapsedSeconds / buffer.duration;

			setProgress((prev) => ({
				...prev,
				[deckId]: {
					position: normalizedProgress > 1 ? 1 : normalizedProgress,
					isPlaying: audioDataRef.current[deckId].isPlaying,
				},
			}));

			const bpm = audioDataRef.current[deckId].bpm;
			const beatsPerSecond = bpm / 60;
			const currentBeat = Math.floor(elapsedSeconds * beatsPerSecond);

			setDebugInfo((prev) => ({
				...prev,
				[deckId]: {
					...prev[deckId],
					currentTime: elapsedSeconds,
					progress: normalizedProgress,
					beatCount: currentBeat,
				},
			}));

			if (normalizedProgress >= 0.99) {
				pauseTrack(deckId);
				audioDataRef.current[deckId].pauseTime = 0;
			}
		});
	};

	// Update transition state
	const updateTransitionState = (): void => {
		if (!audioContextRef.current || !mixingStateRef.current.isTransitioning) return;

		const { fromDeck, toDeck, transitionStartTime, transitionDuration } = mixingStateRef.current;
		const now = audioContextRef.current.currentTime;
		const elapsed = now - transitionStartTime;
		const progress = Math.min(elapsed / transitionDuration, 1);

		updateGainForDeck(fromDeck);
		updateGainForDeck(toDeck);
		updatePlaybackRate(fromDeck);
		updatePlaybackRate(toDeck);

		setDebugInfo((prev) => ({
			...prev,
			transition: {
				...prev.transition,
				elapsedTime: elapsed,
				progress,
				remainingTime: Math.max(0, transitionDuration - elapsed),
			},
		}));

		if (progress >= 1) {
			mixingStateRef.current.isTransitioning = false;
			setIsMixing(false);
			onTransitionComplete();
		}
	};

	const getOrCreateContext = () => {
		if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
			audioContextRef.current = new AudioContext();
		}
		if (audioContextRef.current.state === 'suspended') {
			audioContextRef.current.resume();
		}
		return audioContextRef.current;
	};

	return {
		audioContext: audioContextRef.current,
		analyzerData,
		progress,
		debugInfo,
		isMixing,
		loadTrack,
		playTrack,
		pauseTrack,
		startTransition,
	};
};
