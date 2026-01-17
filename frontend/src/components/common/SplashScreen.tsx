import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function SplashScreen({ onComplete }: { onComplete?: () => void }) {
  const [textVisible, setTextVisible] = useState(false);

  // Colors based on theme
  const blue = "#4F8CFF"; 
  const teal = "#38D9D9";
  const yellow = "#F6E05E";
  const green = "#22C55E";

  useEffect(() => {
    const timer = setTimeout(() => {
      setTextVisible(true);
    }, 1500);

    const completeTimer = setTimeout(() => {
      onComplete?.();
    }, 3200); 

    return () => {
      clearTimeout(timer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const sunVariants = {
    hidden: { scale: 0, opacity: 0, y: 20 },
    visible: { 
      scale: 1, 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 1.2,
        ease: "easeOut",
        delay: 0.2
      }
    }
  };

  const palmVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { 
      pathLength: 1, 
      opacity: 1,
      transition: { 
        duration: 1.5,
        ease: "easeInOut",
        delay: 0.6
      }
    }
  };

  const waveVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { 
      pathLength: 1, 
      opacity: 1,
      transition: { 
        duration: 1,
        ease: "easeInOut",
        delay: 1.2
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-colors duration-300 overflow-hidden">
      
      {/* Background Glow */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.15 }}
        transition={{ duration: 2 }}
        className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent dark:from-primary/20"
      />

      <div className="relative w-64 h-64 flex items-center justify-center">
        <motion.svg
          width="200"
          height="200"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
        >
          {/* Sun */}
          <motion.circle
            cx="70"
            cy="30"
            r="12"
            fill={yellow}
            variants={sunVariants}
            initial="hidden"
            animate="visible"
            className="drop-shadow-[0_0_15px_rgba(246,224,94,0.5)]"
          />

          {/* Palm Tree Trunk */}
          <motion.path
            d="M30 85 C32 70 35 55 35 40"
            stroke="#8B4513"
            strokeWidth="3"
            strokeLinecap="round"
            variants={palmVariants}
            initial="hidden"
            animate="visible"
          />

          {/* Palm Leaves */}
          <motion.path
            d="M35 40 C45 35 55 38 60 45"
            stroke={green}
            strokeWidth="2.5"
            strokeLinecap="round"
            variants={palmVariants}
            initial="hidden"
            animate="visible"
          />
          <motion.path
            d="M35 40 C40 30 50 28 58 32"
            stroke={green}
            strokeWidth="2.5"
            strokeLinecap="round"
            variants={palmVariants}
            initial="hidden"
            animate="visible"
          />
          <motion.path
            d="M35 40 C25 35 15 38 10 45"
            stroke={green}
            strokeWidth="2.5"
            strokeLinecap="round"
            variants={palmVariants}
            initial="hidden"
            animate="visible"
          />
          <motion.path
            d="M35 40 C30 30 20 28 12 32"
            stroke={green}
            strokeWidth="2.5"
            strokeLinecap="round"
            variants={palmVariants}
            initial="hidden"
            animate="visible"
          />

          {/* Sea / Waves */}
          <motion.path
            d="M10 85 Q30 78 50 85 T90 85"
            stroke={blue}
            strokeWidth="4"
            strokeLinecap="round"
            variants={waveVariants}
            initial="hidden"
            animate="visible"
          />
          <motion.path
            d="M20 92 Q40 85 60 92 T100 92"
            stroke={blue}
            strokeWidth="3"
            opacity="0.6"
            strokeLinecap="round"
            variants={waveVariants}
            initial="hidden"
            animate="visible"
          />
        </motion.svg>
      </div>

      {/* Text Reveal */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={textVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="mt-0"
      >
         <h1 className="text-5xl font-black tracking-tighter">
             <span className="text-foreground">Off</span>
            <span className="text-primary font-bold">days</span>
          </h1>
      </motion.div>
    </div>
  );
}
