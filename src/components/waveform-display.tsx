import React, { useRef, useEffect } from 'react';

interface WaveformDisplayProps {
  waveformData: number[];
  progress: number;
  beatMarkers: number[];
  isActive: boolean;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  waveformData,
  progress,
  beatMarkers,
  isActive
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Draw waveform and beat markers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set waveform colors
    const primaryColor = isActive ? '#a855f7' : '#6366f1'; // purple or indigo
    const secondaryColor = isActive ? '#c084fc' : '#818cf8'; // lighter purple or indigo

    // Draw waveform
    const sliceWidth = canvas.width / waveformData.length;
    const centerY = canvas.height / 2;
    const scaleFactor = canvas.height / 2 * 0.9; // Leave some margin

    ctx.beginPath();
    ctx.moveTo(0, centerY);

    for (let i = 0; i < waveformData.length; i++) {
      const amplitude = waveformData[i] * scaleFactor;
      const x = i * sliceWidth;
      const y = centerY - amplitude;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    for (let i = waveformData.length - 1; i >= 0; i--) {
      const amplitude = waveformData[i] * scaleFactor;
      const x = i * sliceWidth;
      const y = centerY + amplitude;
      ctx.lineTo(x, y);
    }

    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, secondaryColor);
    gradient.addColorStop(0.5, primaryColor);
    gradient.addColorStop(1, secondaryColor);

    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.closePath();

    // Draw a subtle outline
    ctx.beginPath();
    for (let i = 0; i < waveformData.length; i++) {
      const amplitude = waveformData[i] * scaleFactor;
      const x = i * sliceWidth;
      const y = centerY - amplitude;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = isActive ? '#c084fc' : '#818cf8';
    ctx.lineWidth = 1;
    ctx.stroke();

  }, [waveformData, isActive]);

  return (
    <div 
      ref={containerRef}
      className="waveform-container"
    >
      <canvas 
        ref={canvasRef}
        className="waveform-canvas"
      />
      
      {/* Progress indicator */}
      <div 
        className="waveform-progress"
        style={{ left: `${progress * 100}%` }}
      />
      
      {/* Beat markers */}
      {beatMarkers.map((position, index) => (
        <div 
          key={index}
          className="waveform-beat-marker"
          style={{ 
            left: `${position * 100}%`,
            opacity: (index % 4 === 0) ? 1 : 0.5 // Highlight every 4th beat
          }}
        />
      ))}
    </div>
  );
};