
'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const tutorialSteps = [
  {
    target: '[data-tutorial="step-0"]',
    title: 'Welcome to LandVision!',
    content: 'This is the tool palette. Let\'s start by drawing a boundary for your project site. Select one of the boundary tools.',
    placement: 'right-start',
  },
  {
    target: '[data-tutorial="step-1"]',
    title: 'Name Your Site',
    content: 'Great! Now give your site a name. This will help you identify your project.',
    placement: 'bottom',
    waitFor: 'dialog'
  },
  {
    target: '[data-tutorial="step-2"]',
    title: 'Your Site',
    content: 'Your site name appears here. You can click it anytime to rename it.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="step-3"]',
    title: 'Slope Analysis',
    content: 'Once a boundary is drawn, you can analyze its elevation and slope. Select the shape on the map to see the details here. Adjust the settings to see how it affects the analysis on the map.',
    placement: 'left-start',
  },
  {
    target: '[data-tutorial="step-4"]',
    title: '3D Visualization',
    content: 'You can switch to a 3D view of your project at any time. Let\'s add some buildings and zones first!',
    placement: 'bottom-end',
  },
  {
    title: 'You\'re All Set!',
    content: 'That\'s a quick overview of the basic features. You can now explore other tools like zoning and building placement. Click the help button anytime to see this tutorial again.',
    placement: 'center',
  },
];

interface TutorialGuideProps {
  step: number;
  setStep: (step: number) => void;
  onFinish: () => void;
}

export function TutorialGuide({ step, setStep, onFinish }: TutorialGuideProps) {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const portalRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    portalRef.current = document.body;
  }, []);

  useEffect(() => {
    const currentStep = tutorialSteps[step];
    if (!currentStep) {
      setIsVisible(false);
      return;
    }

    if (currentStep.placement === 'center') {
      setPosition({ top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 });
      setIsVisible(true);
      return;
    }
    
    let targetElement: HTMLElement | null = null;
    
    // Function to find the element
    const findElement = () => {
        targetElement = document.querySelector(currentStep.target);
        if(targetElement) {
            const rect = targetElement.getBoundingClientRect();
            setPosition({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            });
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    };

    // If the step is waiting for a dialog, we need to poll for it
    if (currentStep.waitFor === 'dialog') {
        const interval = setInterval(() => {
            findElement();
            if (targetElement) {
                clearInterval(interval);
            }
        }, 100);
        return () => clearInterval(interval);
    } else {
        findElement();
    }
    
    window.addEventListener('resize', findElement);
    return () => window.removeEventListener('resize', findElement);

  }, [step]);
  
  if (!isVisible || !portalRef.current) return null;

  const currentStepInfo = tutorialSteps[step];

  const getPopupPosition = () => {
    switch (currentStepInfo.placement) {
      case 'right-start':
        return { top: position.top, left: position.left + position.width + 10 };
      case 'left-start':
        return { top: position.top, right: window.innerWidth - position.left + 10 };
      case 'bottom':
        return { top: position.top + position.height + 10, left: position.left };
      case 'bottom-end':
         return { top: position.top + position.height + 10, right: window.innerWidth - (position.left + position.width) };
      case 'center':
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      default:
        return { top: position.top + position.height + 10, left: position.left };
    }
  };

  const isLastStep = step === tutorialSteps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onFinish}>
      <div
        className="absolute rounded-md border bg-card p-4 text-card-foreground shadow-xl w-80"
        style={getPopupPosition()}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onFinish} className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
        </button>

        <div className="space-y-2">
            <h3 className="font-bold text-lg">{currentStepInfo.title}</h3>
            <p className="text-sm text-muted-foreground">{currentStepInfo.content}</p>
        </div>

        <div className="mt-4 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{step + 1} / {tutorialSteps.length}</span>
            <Button size="sm" onClick={() => isLastStep ? onFinish() : setStep(step + 1)}>
                {isLastStep ? 'Finish' : 'Next'}
            </Button>
        </div>
      </div>
    </div>,
    portalRef.current
  );
}
