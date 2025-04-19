import React from 'react';
import { Volume2, ArrowRightLeft, ChevronRight, ChevronLeft } from 'lucide-react';

interface MixerControlsProps {
	transitionBeats: number;
	onTransitionBeatsChange: (beats: number) => void;
	masterVolume: number;
	onMasterVolumeChange: (volume: number) => void;
	crossfadePosition: number;
	onCrossfadeChange: (position: number) => void;
	onStartMix: () => void;
	canMix: boolean;
	isMixing: boolean;
}

const MixerControls: React.FC<MixerControlsProps> = ({
	transitionBeats,
	onTransitionBeatsChange,
	masterVolume,
	onMasterVolumeChange,
	crossfadePosition,
	onCrossfadeChange,
	onStartMix,
	canMix,
	isMixing,
}) => {
	// Available transition beat options
	const transitionOptions = [8, 16, 32, 64];

	return (
		<div className='bg-neutral-800 rounded-lg p-4 border border-neutral-700'>
			<h3 className='text-lg font-semibold mb-4 text-center text-violet-300'>Mixer Controls</h3>

			<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
				{/* Transition Duration */}
				<div>
					<label className='block text-sm font-medium text-neutral-300 mb-2'>Transition Duration (beats)</label>
					<div className='flex gap-2'>
						{transitionOptions.map((option) => (
							<button key={option} className={`mixer-button flex-1 ${transitionBeats === option ? 'bg-violet-700' : ''}`} onClick={() => onTransitionBeatsChange(option)}>
								{option}
							</button>
						))}
					</div>
				</div>

				{/* Crossfader */}
				<div>
					<label className='text-sm font-medium text-neutral-300 mb-2 flex justify-between'>
						<span>Crossfader</span>
						<span className='text-xs text-neutral-400'>{crossfadePosition === 0 ? 'Deck 1' : 'Deck 2'}</span>
					</label>
					<div className='flex items-center gap-2'>
						<ChevronLeft className='text-blue-400' size={18} />
						<input type='range' min='0' max='1' step='1' value={crossfadePosition} onChange={(e) => onCrossfadeChange(Number(e.target.value))} className='mixer-slider' />
						<ChevronRight className='text-violet-400' size={18} />
					</div>
				</div>

				{/* Master Volume */}
				<div>
					<label className='text-sm font-medium text-neutral-300 mb-2 flex justify-between'>
						<span>Master Volume</span>
						<span className='text-xs text-neutral-400'>{Math.round(masterVolume * 100)}%</span>
					</label>
					<div className='flex items-center gap-2'>
						<Volume2 className='text-neutral-400' size={18} />
						<input type='range' min='0' max='1' step='0.01' value={masterVolume} onChange={(e) => onMasterVolumeChange(Number(e.target.value))} className='mixer-slider' />
					</div>
				</div>
			</div>

			{/* Start Automix Button */}
			<div className='mt-6 flex justify-center'>
				<button
					className={`mixer-button px-6 py-3 flex items-center gap-2 ${
						canMix ? 'bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500' : 'bg-neutral-700 opacity-50 cursor-not-allowed'
					}`}
					onClick={onStartMix}
					disabled={!canMix}>
					<ArrowRightLeft size={20} />
					<span>{isMixing ? 'Mixing...' : 'Start Automix'}</span>
				</button>
			</div>
		</div>
	);
};

export default MixerControls;
