import React, { useRef } from 'react';
import { WaveformDisplay } from './waveform-display';
import { Music, Play, Pause, Upload } from 'lucide-react';

interface TrackDeckProps {
	deckId: string;
	track: any | null;
	onLoadTrack: (file: File) => void;
	onPlayPause: () => void;
	isActive: boolean;
	isPlaying: boolean;
	progress: number;
	beatMarkers: number[];
	waveformData: number[];
}

const TrackDeck: React.FC<TrackDeckProps> = ({ deckId, track, onLoadTrack, onPlayPause, isActive, isPlaying, progress, beatMarkers, waveformData }) => {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (files && files.length > 0) {
			onLoadTrack(files[0]);
		}
	};

	// Format duration in MM:SS format
	const formatDuration = (seconds: number): string => {
		if (!seconds) return '00:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	};

	// Format BPM with 1 decimal place
	const formatBPM = (bpm: number): string => {
		return bpm ? bpm.toFixed(1) : '--';
	};

	return (
		<div className={`deck ${isActive ? 'deck-active' : ''}`}>
			<div className='flex justify-between items-center mb-3'>
				<h3 className='text-lg font-semibold text-violet-300 flex items-center gap-1'>
					<Music size={18} />
					Deck {deckId.replace('deck', '')}
				</h3>
				<div className='flex items-center gap-3'>
					{track && (
						<button className='mixer-button px-3 py-1' onClick={onPlayPause}>
							{isPlaying ? <Pause size={18} /> : <Play size={18} />}
						</button>
					)}
					<button className='mixer-button px-3 py-1' onClick={() => fileInputRef.current?.click()}>
						<Upload size={18} />
					</button>
					<input ref={fileInputRef} type='file' accept='audio/*' onChange={handleFileSelect} className='hidden' />
				</div>
			</div>

			{track ? (
				<div>
					<div className='text-sm font-medium mb-2 truncate' title={track.name}>
						{track.name}
					</div>

					<div className='grid grid-cols-2 text-xs text-neutral-400 mb-2'>
						<div>
							BPM: <span className='text-blue-400'>{formatBPM(track.bpm)}</span>
						</div>
						<div className='text-right'>
							Duration: <span className='text-violet-400'>{formatDuration(track.duration)}</span>
						</div>
					</div>

					<WaveformDisplay waveformData={waveformData} progress={progress} beatMarkers={beatMarkers} isActive={isActive} />
				</div>
			) : (
				<div className='waveform-container flex items-center justify-center'>
					<div className='text-neutral-500 text-center'>
						<p>No track loaded</p>
						<p className='text-xs mt-1'>Click the upload button to load an audio file</p>
					</div>
				</div>
			)}
		</div>
	);
};

export default TrackDeck;
