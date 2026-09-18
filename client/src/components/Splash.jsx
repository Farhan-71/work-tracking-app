import { useNavigate } from 'react-router-dom'
import PixelArt from './PixelArt'

export default function Splash() {
  const navigate = useNavigate()

  const handleStart = () => {
    navigate('/intro')
  }

  return (
    <div className="min-h-screen bg-dayflow-dark flex flex-col items-center justify-center relative border-4 border-dayflow-blue">
      {/* Status indicator top left */}
      <div className="absolute top-4 left-4 w-4 h-4 bg-white"></div>
      
      {/* Main logo button */}
      <div className="mb-8">
        <button 
          onClick={handleStart}
          className="bg-dayflow-red text-white px-8 py-4 text-3xl font-bold border-2 border-white rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
        >
          DAYFLOW
        </button>
      </div>
      
      {/* Pixel art characters */}
      <div className="flex gap-8 mb-8">
        {/* Cat character */}
        <PixelArt type="cat" />
        {/* Rabbit character */}
        <PixelArt type="bunny" />
      </div>
      
      {/* Tagline text */}
      <div className="text-center space-y-2">
        <p className="text-white text-xl font-bold">TRACK TODAY</p>
        <p className="text-white text-xl font-bold">GROW TOMORROW</p>
      </div>
      
      {/* Status indicator bottom right */}
      <div className="absolute bottom-4 right-4 w-4 h-4 bg-white"></div>
    </div>
  )
}
