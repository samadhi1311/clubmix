import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp } from 'lucide-react';

interface DebugPanelProps {
	debugInfo: any;
	isTransitioning: boolean;
	analyzerData: any;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ debugInfo, isTransitioning, analyzerData }) => {
	const [isExpanded, setIsExpanded] = useState(true);

	return (
		<div className='bg-neutral-800 rounded-lg p-4 border border-neutral-700'>
			<div className='flex justify-between items-center cursor-pointer' onClick={() => setIsExpanded(!isExpanded)}>
				<h3 className='text-lg font-semibold flex items-center gap-2 text-neutral-300'>
					<Terminal size={18} className='text-neutral-400' />
					System Output
				</h3>
				<button className='text-neutral-400 hover:text-neutral-300'>{isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
			</div>

			{isExpanded && (
				<div className='mt-4 text-sm'>
					<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
						{/* Deck 1 Information */}
						<div className='bg-neutral-900 rounded-md p-3'>
							<h4 className='text-blue-400 font-medium mb-2'>Deck 1 Info</h4>
							<div className='grid grid-cols-2 gap-2 text-xs'>
								<div>
									<span className='text-neutral-400'>Detected BPM:</span> <span className='debug-value'>{debugInfo.deck1?.bpm?.toFixed(1) || 'N/A'}</span>
								</div>
								<div>
									<span className='text-neutral-400'>Current BPM:</span> <span className='debug-value'>{debugInfo.deck1?.currentBpm?.toFixed(1) || 'N/A'}</span>
								</div>
								<div>
									<span className='text-neutral-400'>Beat Count:</span> <span className='debug-value'>{debugInfo.deck1?.beatCount || 0}</span>
								</div>
								<div>
									<span className='text-neutral-400'>Time:</span> <span className='debug-value'>{debugInfo.deck1?.currentTime?.toFixed(2) || '0.00'}s</span>
								</div>
								<div>
									<span className='text-neutral-400'>Playback Rate:</span> <span className='debug-value'>{debugInfo.deck1?.playbackRate?.toFixed(2) || '1.00'}x</span>
								</div>
								<div>
									<span className='text-neutral-400'>Volume:</span> <span className='debug-value'>{Math.round((debugInfo.deck1?.volume || 0) * 100)}%</span>
								</div>
							</div>
						</div>

						{/* Deck 2 Information */}
						<div className='bg-neutral-900 rounded-md p-3'>
							<h4 className='text-violet-400 font-medium mb-2'>Deck 2 Info</h4>
							<div className='grid grid-cols-2 gap-2 text-xs'>
								<div>
									<span className='text-neutral-400'>Detected BPM:</span> <span className='debug-value'>{debugInfo.deck2?.bpm?.toFixed(1) || 'N/A'}</span>
								</div>
								<div>
									<span className='text-neutral-400'>Current BPM:</span> <span className='debug-value'>{debugInfo.deck2?.currentBpm?.toFixed(1) || 'N/A'}</span>
								</div>
								<div>
									<span className='text-neutral-400'>Beat Count:</span> <span className='debug-value'>{debugInfo.deck2?.beatCount || 0}</span>
								</div>
								<div>
									<span className='text-neutral-400'>Time:</span> <span className='debug-value'>{debugInfo.deck2?.currentTime?.toFixed(2) || '0.00'}s</span>
								</div>
								<div>
									<span className='text-neutral-400'>Playback Rate:</span> <span className='debug-value'>{debugInfo.deck2?.playbackRate?.toFixed(2) || '1.00'}x</span>
								</div>
								<div>
									<span className='text-neutral-400'>Volume:</span> <span className='debug-value'>{Math.round((debugInfo.deck2?.volume || 0) * 100)}%</span>
								</div>
							</div>
						</div>
					</div>

					{/* Mixing Status */}
					<div className='mt-4 bg-neutral-900 rounded-md p-3'>
						<h4 className='text-green-400 font-medium mb-2'>Mixing Status</h4>
						<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs'>
							<div>
								<span className='text-neutral-400'>Transition Status:</span>{' '}
								<span className={`debug-value ${isTransitioning ? 'text-green-400' : 'text-neutral-300'}`}>{isTransitioning ? 'In Progress' : 'Idle'}</span>
							</div>
							<div>
								<span className='text-neutral-400'>Master BPM:</span> <span className='debug-value'>{debugInfo.master?.bpm?.toFixed(1) || 'N/A'}</span>
							</div>
							<div>
								<span className='text-neutral-400'>Transition Duration:</span>{' '}
								<span className='debug-value'>
									{debugInfo.transition?.durationBeats || 0} beats ({(debugInfo.transition?.durationSeconds || 0).toFixed(1)}s)
								</span>
							</div>
							<div>
								<span className='text-neutral-400'>Transition Progress:</span> <span className='debug-value'>{Math.round((debugInfo.transition?.progress || 0) * 100)}%</span>
							</div>
							<div>
								<span className='text-neutral-400'>Detected Beats:</span>{' '}
								<span className='debug-value'>
									Deck 1: {analyzerData.deck1?.beatPositions?.length || 0}, Deck 2: {analyzerData.deck2?.beatPositions?.length || 0}
								</span>
							</div>
							<div>
								<span className='text-neutral-400'>Active Source:</span>{' '}
								<span className='debug-value'>
									{debugInfo.transition?.fromDeck || 'None'} → {debugInfo.transition?.toDeck || 'None'}
								</span>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default DebugPanel;
