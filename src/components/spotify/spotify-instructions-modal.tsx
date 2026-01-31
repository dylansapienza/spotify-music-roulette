'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface SpotifyInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const steps = [
  {
    number: 1,
    title: 'Go to your profile',
    description: 'Tap your profile picture in the top right',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>
    ),
  },
  {
    number: 2,
    title: 'Tap the share button',
    description: 'Look for the three dots menu, then Share',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </svg>
    ),
    // Show a more prominent share icon illustration
    extraIcon: (
      <div className="mt-2 flex items-center gap-2 text-white/50 text-xs">
        <svg className="w-5 h-5 text-[#1DB954]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
        <span>or</span>
        <svg className="w-5 h-5 text-[#1DB954]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      </div>
    ),
  },
  {
    number: 3,
    title: 'Tap "Copy link"',
    description: 'This copies your profile URL',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
      </svg>
    ),
  },
  {
    number: 4,
    title: 'Come back and paste',
    description: "We'll auto-detect your link!",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 14l-4-4 4-4"/>
        <path d="M5 10h11a4 4 0 014 4v3"/>
      </svg>
    ),
  },
];

export function SpotifyInstructionsModal({ isOpen, onClose }: SpotifyInstructionsModalProps) {
  const handleOpenSpotify = () => {
    // Open Spotify app
    window.location.href = 'spotify://user';
    // Close modal after a brief delay
    setTimeout(onClose, 300);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto bg-gradient-to-b from-zinc-900 to-black border border-white/10 rounded-2xl shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-b from-zinc-900 to-zinc-900/95 p-4 pb-3 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  How to Get Your Profile Link
                </h2>
                <button
                  onClick={onClose}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Steps */}
            <div className="p-4 space-y-3">
              {steps.map((step, index) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start gap-3"
                >
                  {/* Step number badge */}
                  <div className="w-6 h-6 rounded-full bg-[#1DB954] text-black text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {step.number}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white/60">{step.icon}</span>
                      <p className="text-white font-medium text-sm">{step.title}</p>
                    </div>
                    <p className="text-white/50 text-xs mt-1">{step.description}</p>
                    {step.extraIcon}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* CTA Button */}
            <div className="p-4 pt-2">
              <Button
                onClick={handleOpenSpotify}
                className="w-full flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Open Spotify App
              </Button>
              <p className="text-white/30 text-xs text-center mt-3">
                Tap anywhere to dismiss
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
