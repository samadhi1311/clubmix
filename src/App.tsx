import { MusicIcon } from 'lucide-react';
import MixerInterface from './components/mixer-interface';
import './App.css';

function App() {
	return (
		<div className='min-h-screen w-full bg-gradient-to-br from-neutral-950 to-neutral-900 p-4 text-neutral-100 md:p-6'>
			<header className='container mx-auto mb-6'>
				<div className='flex items-center gap-2'>
					<MusicIcon className='text-violet-500' size={32} />
					<h1 className='bg-gradient-to-r from-violet-400 to-blue-600 bg-clip-text text-center text-2xl font-bold text-transparent'>clubmix</h1>
				</div>
			</header>

			<main className='container mx-auto'>
				<MixerInterface />
			</main>
		</div>
	);
}

export default App;
