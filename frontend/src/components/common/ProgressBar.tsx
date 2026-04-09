import React from 'react';

const ProgressBar = ({ currentStep, totalSteps, steps }) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                  index + 1 < currentStep
                    ? 'bg-green-500 text-white'
                    : index + 1 === currentStep
                    ? 'bg-primary-600 text-white ring-4 ring-primary-200'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {index + 1 < currentStep ? '✓' : index + 1}
              </div>
              <span className="text-xs mt-2 text-center font-medium text-gray-700">
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 h-1 mx-2">
                <div
                  className={`h-full rounded transition-all duration-300 ${
                    index + 1 < currentStep ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="text-center mt-4">
        <p className="text-sm text-gray-600">
          Step {currentStep} of {totalSteps}
        </p>
      </div>
    </div>
  );
};

export default ProgressBar;
