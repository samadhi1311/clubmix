import { MusicIcon } from 'lucide-react';
import MixerInterface from './components/mixer-interface';
import './App.css';

function App() {
	return (
		<div className='min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100 p-4 md:p-6'>
			<header className='mb-6'>
				<div className='flex items-center gap-2'>
					<MusicIcon className='text-purple-500' size={32} />
					<h1 className='text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-600'>clubmix</h1>
				</div>
			</header>

			<main className='container mx-auto'>
				<MixerInterface />
			</main>
		</div>
	);
}

export default App;
