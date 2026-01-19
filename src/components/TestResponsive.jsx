// src/components/TestResponsive.jsx
export default function TestResponsive() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-8">
          Responsive Test
        </h1>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Cards that respond to screen size */}
          {['iPhone', 'Android', 'Tablet', 'Laptop'].map((device) => (
            <div key={device} className="card">
              <div className="text-center">
                <div className="text-4xl mb-4">
                  {device === 'iPhone' && '📱'}
                  {device === 'Android' && '📱'}
                  {device === 'Tablet' && '📟'}
                  {device === 'Laptop' && '💻'}
                </div>
                <h3 className="text-lg font-semibold mb-2">{device}</h3>
                <p className="text-sm text-gray-600">
                  This card is visible on {device.toLowerCase()} screens
                </p>
              </div>
            </div>
          ))}
        </div>
        
        {/* Responsive text */}
        <div className="mt-8 card">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-4">
            Text Size Test
          </h2>
          <p className="text-sm sm:text-base md:text-lg">
            This text changes size based on screen width. On mobile it's smaller, on desktop it's larger.
          </p>
        </div>
      </div>
    </div>
  );
}