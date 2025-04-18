'use client';

import { useState, useRef } from 'react';
import { detectBPM, automaticTransition, detectBeats } from '@/lib/audio';
import * as Tone from 'tone';

export default function DJPlayer() {
	const transport = Tone.getTransport();
	const [isReady, setIsReady] = useState(false);
	const player1Ref = useRef<Tone.Player | null>(null);
	const player2Ref = useRef<Tone.Player | null>(null);

	const handleFiles = async (files: FileList | null) => {
		if (!files || files.length < 2) return;

		await Tone.start(); // Ensure context is resumed
		transport.start(); // Start transport to sync timing

		const ctx = Tone.getContext().rawContext;

		const buffers = await Promise.all(
			[files[0], files[1]].map(async (file) => {
				const arrayBuffer = await file.arrayBuffer();
				return await ctx.decodeAudioData(arrayBuffer);
			})
		);

		const [buffer1, buffer2] = buffers;

		const p1 = new Tone.Player(buffer1).toDestination();
		const p2 = new Tone.Player(buffer2).toDestination();

		player1Ref.current = p1;
		player2Ref.current = p2;

		const { bpm: bpm1, offset: offset1 } = await detectBPM(buffer1);
		const { bpm: bpm2, offset: offset2 } = await detectBPM(buffer2);

		const beats1 = detectBeats(buffer1, bpm1, offset1); // Replace with beat times from buffer1
		const beats2 = detectBeats(buffer2, bpm2, offset2); // Replace with beat times from buffer2

		const startTime = transport.seconds; // Transport time for sync

		// Schedule the start of player1 with the correct offset
		transport.schedule((time) => {
			p1.start(time, offset1);
		}, startTime);

		// Schedule the start of player2 aligned with player1's beats
		automaticTransition(p1, p2, bpm1, bpm2, beats1, beats2, startTime);

		setIsReady(true);
	};

	return (
		<div className='space-y-4'>
			<input type='file' accept='audio/*' multiple onChange={(e) => handleFiles(e.target.files)} />
			{!isReady && <p>Select 2 audio files to mix.</p>}
		</div>
	);
}
