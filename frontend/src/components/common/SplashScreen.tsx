import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function SplashScreen({ onComplete }: { onComplete?: () => void }) {
  const [textVisible, setTextVisible] = useState(false);

  // Colors
  const teal = "#0ECDBF"; 

  useEffect(() => {
    const timer = setTimeout(() => {
      setTextVisible(true);
    }, 1200);

    const completeTimer = setTimeout(() => {
      onComplete?.();
    }, 2800); // Slightly increased to let the animation breathe

    return () => {
      clearTimeout(timer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const pathVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { 
      pathLength: 1, 
      opacity: 1,
      transition: { 
        duration: 1,
        ease: "easeInOut" 
      }
    }
  };
  
  const checkmarkVariants = {
    hidden: { pathLength: 0, opacity: 0, scale: 0.8 },
    visible: { 
      pathLength: 1, 
      opacity: 1, 
      scale: 1,
      transition: { 
        duration: 0.5, 
        ease: "backOut",
        delay: 1.2 // Wait for blocks 
      }
    }
  };

  const blockVariants = {
    hidden: { opacity: 0, scale: 0.5 },
    visible: (i: number) => ({ 
      opacity: 0.4, // Keep them subtle
      scale: 1,
      transition: { 
        duration: 0.4,
        delay: 0.5 + i * 0.05,
        ease: "easeOut"
      }
    })
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-colors duration-300">
      
      <div className="relative w-48 h-48 flex items-center justify-center">
        <motion.svg
          width="160"
          height="160"
          viewBox="0 0 100 100"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Calendar Body */}
          <motion.path 
            d="M80 88H20C14.4772 88 10 83.5228 10 78V28C10 22.4772 14.4772 18 20 18H80C85.5228 18 90 22.4772 90 28V78C90 83.5228 85.5228 88 80 88Z"
            stroke={teal}
            strokeWidth="6"
            fill="transparent"
            variants={pathVariants}
          />
          
          {/* Top Line inside calendar */}
          <motion.path 
            d="M10 40H90"
            stroke={teal}
            strokeWidth="4" 
            fill="transparent"
            variants={pathVariants} 
          />

          {/* Bindings / Rings */}
          <motion.path 
             d="M30 12V24"
             stroke={teal}
             strokeWidth="6"
             variants={pathVariants}
          />
          <motion.path 
             d="M70 12V24"
             stroke={teal}
             strokeWidth="6"
             variants={pathVariants}
          />

          {/* Calendar Grid "Blocks" */}
          {[0, 1, 2, 3].map((col) => 
            [0, 1, 2].map((row) => (
              <motion.rect
                key={`${col}-${row}`}
                x={24 + col * 15}
                y={48 + row * 12}
                width="8"
                height="6"
                rx="1.5"
                fill={teal}
                variants={blockVariants}
                custom={col + row * 4}
              />
            ))
          )}

          {/* Checkmark */}
          <motion.path 
            d="M35 60 L50 72 L75 48"
            stroke={teal}
            strokeWidth="8"
            fill="transparent"
            variants={checkmarkVariants}
          />
        </motion.svg>
      </div>

      {/* Text Reveal */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={textVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mt-1"
      >
         <h1 className="text-4xl font-bold tracking-wider">
            {/* Off - Standard Text Color (Dark Blue / White in Dark Mode? Or Teal in Dark Mode based on user instruction? 
                User said: "Dark Mode: Off (White), days (Teal)" from my reasoning.
                Let's use `text-foreground` which handles standard text color automatically (Dark in Light mode, White in Dark mode).
                Wait, user had specific hex before. Let's stick closer to the "Off" matches "Vault" instruction.
                Vaul was: `text-[#0B223A] dark:text-[#0ECDBF]`
                But if we follow "days is primary", then Off should probably be neutral in dark mode unless we want teal-teal.
                Actually, let's stick to the cleanest interpretation:
                Off: Neutral (Foreground)
                days: Primary (Teal)
            */}
             <span className="text-[#0B223A] dark:text-white">Off</span>
            <span className="text-[#0ECDBF]">days</span>
          </h1>
      </motion.div>
    </div>
  );
}
