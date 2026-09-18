import React from 'react'

const PixelArt = ({ type }) => {
  const catPixels = [
    ['white', 'white', 'black', 'black', 'black', 'white', 'white', 'white'],
    ['white', 'white', 'black', 'black', 'black', 'white', 'white', 'white'],
    ['white', 'white', 'black', 'black', 'black', 'white', 'white', 'white'],
    ['white', 'white', 'black', 'black', 'black', 'white', 'white', 'white'],
    ['white', 'white', 'white', 'black', 'black', 'white', 'white', 'white'],
    ['white', 'white', 'white', 'black', 'black', 'white', 'white', 'white'],
    ['white', 'white', 'white', 'white', 'white', 'white', 'white', 'white'],
    ['white', 'white', 'white', 'white', 'white', 'white', 'white', 'white'],
  ]

  const bunnyPixels = [
    ['white', 'white', 'pink', 'pink', 'pink', 'pink', 'white', 'white'],
    ['white', 'white', 'pink', 'pink', 'pink', 'pink', 'white', 'white'],
    ['white', 'white', 'white', 'white', 'white', 'white', 'white', 'white'],
    ['white', 'white', 'black', 'black', 'black', 'black', 'white', 'white'],
    ['white', 'white', 'black', 'black', 'black', 'black', 'white', 'white'],
    ['white', 'white', 'white', 'white', 'white', 'white', 'white', 'white'],
    ['white', 'white', 'white', 'white', 'white', 'white', 'white', 'white'],
    ['white', 'white', 'white', 'white', 'white', 'white', 'white', 'white'],
  ]

  const pixels = type === 'cat' ? catPixels : bunnyPixels

  const colorMap = {
    white: '#ffffff',
    black: '#1a1a1a',
    pink: '#ffb6c1',
  }

  return (
    <div 
      className="border-2 border-black rounded-lg"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gridTemplateRows: 'repeat(8, 1fr)',
        width: '80px',
        height: '80px',
        gap: '1px',
      }}
    >
      {pixels.map((row, rowIndex) =>
        row.map((color, colIndex) => (
          <div
            key={`${rowIndex}-${colIndex}`}
            style={{
              backgroundColor: colorMap[color],
              width: '100%',
              height: '100%',
            }}
          />
        ))
      )}
    </div>
  )
}

export default PixelArt
