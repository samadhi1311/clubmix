import React, { useState } from 'react';
import TrackDeck from './track-deck';
import MixerControls from './mixer-controls';
import DebugPanel from './debug-panel';
import { useAudioProcessing } from '../hooks/use-audio-processing';
import { Track } from '../types/audio';

const MixerInterface: React.FC = () => {
	const [tracks, setTracks] = useState<{ deck1: Track | null; deck2: Track | null }>({
		deck1: null,
		deck2: null,
	});

	const [transitionBeats, setTransitionBeats] = useState<number>(16);
	const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
	const [masterVolume, setMasterVolume] = useState<number>(0.8);
	const [crossfadePosition, setCrossfadePosition] = useState<number>(0); // 0 = deck1, 1 = deck2

	const { audioContext, analyzerData, loadTrack, playTrack, pauseTrack, startTransition, isMixing, progress, debugInfo } = useAudioProcessing({
		transitionBeats,
		masterVolume,
		onTransitionComplete: () => {
			setIsTransitioning(false);
			setCrossfadePosition(crossfadePosition === 0 ? 1 : 0);
		},
	});

	const handleTrackLoad = async (file: File, deckId: 'deck1' | 'deck2') => {
		try {
			// Create a basic track object
			const newTrack: Track = {
				id: `track-${Date.now()}`,
				file,
				name: file.name,
				duration: 0, // Will be set after loading
				bpm: 0, // Will be detected after loading
				key: '', // Would need key detection algorithm
				waveformData: [],
			};

			// Update the deck with the new track
			setTracks((prev) => ({
				...prev,
				[deckId]: newTrack,
			}));

			// Load the track into the audio processor
			await loadTrack(file, deckId);

			// Update the track with the detected BPM and other info
			if (debugInfo[deckId]) {
				setTracks((prev) => {
					if (!prev[deckId]) return prev;

					return {
						...prev,
						[deckId]: {
							...prev[deckId]!,
							bpm: debugInfo[deckId].bpm || 0,
							duration: debugInfo[deckId].duration || 0,
							waveformData: analyzerData[deckId]?.waveform || [],
						},
					};
				});
			}
		} catch (error) {
			console.error('Error loading track:', error);
		}
	};

	const handleStartMix = () => {
		if (tracks.deck1 && tracks.deck2 && !isTransitioning) {
			setIsTransitioning(true);
			startTransition(crossfadePosition === 0 ? 'deck1' : 'deck2');
		}
	};

	const handlePlayPause = (deckId: 'deck1' | 'deck2') => {
		if (progress[deckId]?.isPlaying) {
			pauseTrack(deckId);
		} else {
			playTrack(deckId);
		}
	};

	return (
		<div className='flex flex-col gap-6'>
			<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
				<TrackDeck
					deckId='deck1'
					track={tracks.deck1}
					onLoadTrack={(file) => handleTrackLoad(file, 'deck1')}
					onPlayPause={() => handlePlayPause('deck1')}
					isActive={crossfadePosition === 0}
					isPlaying={progress.deck1?.isPlaying || false}
					progress={progress.deck1?.position || 0}
					beatMarkers={analyzerData.deck1?.beatPositions || []}
					waveformData={analyzerData.deck1?.waveform || []}
				/>

				<TrackDeck
					deckId='deck2'
					track={tracks.deck2}
					onLoadTrack={(file) => handleTrackLoad(file, 'deck2')}
					onPlayPause={() => handlePlayPause('deck2')}
					isActive={crossfadePosition === 1}
					isPlaying={progress.deck2?.isPlaying || false}
					progress={progress.deck2?.position || 0}
					beatMarkers={analyzerData.deck2?.beatPositions || []}
					waveformData={analyzerData.deck2?.waveform || []}
				/>
			</div>

			<MixerControls
				transitionBeats={transitionBeats}
				onTransitionBeatsChange={setTransitionBeats}
				masterVolume={masterVolume}
				onMasterVolumeChange={setMasterVolume}
				crossfadePosition={crossfadePosition}
				onCrossfadeChange={setCrossfadePosition}
				onStartMix={handleStartMix}
				canMix={!!tracks.deck1 && !!tracks.deck2 && !isTransitioning}
				isMixing={isMixing}
			/>

			<DebugPanel debugInfo={debugInfo} isTransitioning={isTransitioning} analyzerData={analyzerData} />
		</div>
	);
};

export default MixerInterface;
