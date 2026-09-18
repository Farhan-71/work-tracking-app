import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PixelArt from './PixelArt'

const introScreens = [
  {
    id: 1,
    bgColor: 'bg-pink-100',
    characterType: 'cat',
    title: 'STAY FOCUSED',
    description: 'Pomodoro mode keeps you locked in.',
    buttonColor: 'bg-dayflow-red',
  },
  {
    id: 2,
    bgColor: 'bg-pink-200',
    characterType: 'bunny',
    title: 'CAPTURE TASKS',
    description: 'Grab every to-do before it slips away.',
    buttonColor: 'bg-dayflow-red',
  },
  {
    id: 3,
    bgColor: 'bg-green-200',
    characterType: 'cat',
    title: 'LEVEL UP!',
    description: 'Charts and streaks celebrate every win.',
    buttonColor: 'bg-dayflow-green',
  },
]

export default function Intro() {
  const navigate = useNavigate()
  const [currentScreen, setCurrentScreen] = useState(0)

  const handleNext = () => {
    if (currentScreen < introScreens.length - 1) {
      setCurrentScreen(currentScreen + 1)
    } else {
      navigate('/home')
    }
  }

  const handleSkip = () => {
    navigate('/home')
  }

  const screen = introScreens[currentScreen]

  return (
    <div className={`min-h-screen ${screen.bgColor} flex flex-col items-center justify-center p-6 border-4 border-dayflow-blue`}>
      {/* Progress indicators */}
      <div className="flex gap-2 mb-12">
        {introScreens.map((_, index) => (
          <div
            key={index}
            className={`w-3 h-3 border-2 ${
              index === currentScreen
                ? screen.buttonColor === 'bg-dayflow-red'
                  ? 'bg-dayflow-red border-dayflow-red'
                  : 'bg-dayflow-green border-dayflow-green'
                : index < currentScreen
                ? 'bg-gray-400 border-gray-400'
                : 'border-gray-400 bg-transparent'
            }`}
          />
        ))}
      </div>

      {/* Character */}
      <div className="mb-12">
        <PixelArt type={screen.characterType} />
      </div>

      {/* Content card */}
      <div className="bg-white/90 rounded-xl p-6 w-full max-w-sm mb-8 border-2">
        <h2 className={`text-2xl font-bold mb-2 ${
          screen.buttonColor === 'bg-dayflow-red' ? 'text-dayflow-red' : 'text-dayflow-green'
        }`}>
          {screen.title}
        </h2>
        <p className="text-gray-600">{screen.description}</p>
      </div>

      {/* Next button */}
      <button
        onClick={handleNext}
        className={`${screen.buttonColor} text-white px-8 py-4 rounded-lg font-bold text-lg flex items-center gap-2 mb-4`}
      >
        {currentScreen === introScreens.length - 1 ? 'START' : 'NEXT'}
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
        </svg>
      </button>

      {/* Skip button */}
      <button
        onClick={handleSkip}
        className="text-gray-500 text-sm underline"
      >
        skip intro
      </button>
    </div>
  )
}
