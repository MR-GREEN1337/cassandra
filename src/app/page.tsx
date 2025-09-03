'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PlanetIcon } from '@/components/PlanetIcon';

type Uniforms = {
  [key: string]: {
    value: number[] | number[][] | number;
    type: string;
  };
};

interface ShaderProps {
  source: string;
  uniforms: {
    [key: string]: {
      value: number[] | number[][] | number;
      type: string;
    };
  };
  maxFps?: number;
}

interface PageProps {
  className?: string;
}

const CanvasRevealEffect = ({
  animationSpeed = 10,
  opacities = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1],
  colors = [[0, 255, 255]],
  containerClassName,
  dotSize,
  showGradient = true,
  reverse = false,
}: {
  animationSpeed?: number;
  opacities?: number[];
  colors?: number[][];
  containerClassName?: string;
  dotSize?: number;
  showGradient?: boolean;
  reverse?: boolean;
}) => {
  return (
    <div className={cn('h-full relative w-full', containerClassName)}>
      <div className="h-full w-full">
        <DotMatrix
          colors={colors ?? [[0, 255, 255]]}
          dotSize={dotSize ?? 3}
          opacities={
            opacities ?? [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1]
          }
          shader={`
            ${reverse ? 'u_reverse_active' : 'false'}_;
            animation_speed_factor_${animationSpeed.toFixed(1)}_;
          `}
          center={['x', 'y']}
        />
      </div>
      {showGradient && (
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
      )}
    </div>
  );
};

interface DotMatrixProps {
  colors?: number[][];
  opacities?: number[];
  totalSize?: number;
  dotSize?: number;
  shader?: string;
  center?: ('x' | 'y')[];
}

const DotMatrix: React.FC<DotMatrixProps> = ({
  colors = [[0, 0, 0]],
  opacities = [0.04, 0.04, 0.04, 0.04, 0.04, 0.08, 0.08, 0.08, 0.08, 0.14],
  totalSize = 20,
  dotSize = 2,
  shader = '',
  center = ['x', 'y'],
}) => {
  const uniforms = React.useMemo(() => {
    let colorsArray = [
      colors[0],
      colors[0],
      colors[0],
      colors[0],
      colors[0],
      colors[0],
    ];
    if (colors.length === 2) {
      colorsArray = [
        colors[0],
        colors[0],
        colors[0],
        colors[1],
        colors[1],
        colors[1],
      ];
    } else if (colors.length === 3) {
      colorsArray = [
        colors[0],
        colors[0],
        colors[1],
        colors[1],
        colors[2],
        colors[2],
      ];
    }
    return {
      u_colors: {
        value: colorsArray.map((color) => [
          color[0] / 255,
          color[1] / 255,
          color[2] / 255,
        ]),
        type: 'uniform3fv',
      },
      u_opacities: {
        value: opacities,
        type: 'uniform1fv',
      },
      u_total_size: {
        value: totalSize,
        type: 'uniform1f',
      },
      u_dot_size: {
        value: dotSize,
        type: 'uniform1f',
      },
      u_reverse: {
        value: shader.includes('u_reverse_active') ? 1 : 0,
        type: 'uniform1i',
      },
    };
  }, [colors, opacities, totalSize, dotSize, shader]);

  return (
    <Shader
      source={`
        precision mediump float;
        in vec2 fragCoord;

        uniform float u_time;
        uniform float u_opacities[10];
        uniform vec3 u_colors[6];
        uniform float u_total_size;
        uniform float u_dot_size;
        uniform vec2 u_resolution;
        uniform int u_reverse;

        out vec4 fragColor;

        float PHI = 1.61803398874989484820459;
        float random(vec2 xy) {
            return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
        }
        float map(float value, float min1, float max1, float min2, float max2) {
            return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
        }

        void main() {
            vec2 st = fragCoord.xy;
            ${
              center.includes('x')
                ? 'st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));'
                : ''
            }
            ${
              center.includes('y')
                ? 'st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));'
                : ''
            }

            float opacity = step(0.0, st.x);
            opacity *= step(0.0, st.y);

            vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

            float frequency = 5.0;
            float show_offset = random(st2);
            float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
            opacity *= u_opacities[int(rand * 10.0)];
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

            vec3 color = u_colors[int(show_offset * 6.0)];

            float animation_speed_factor = 0.5;
            vec2 center_grid = u_resolution / 2.0 / u_total_size;
            float dist_from_center = distance(center_grid, st2);

            float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);

            float max_grid_dist = distance(center_grid, vec2(0.0, 0.0));
            float timing_offset_outro = (max_grid_dist - dist_from_center) * 0.02 + (random(st2 + 42.0) * 0.2);

            float current_timing_offset;
            if (u_reverse == 1) {
                current_timing_offset = timing_offset_outro;
                 opacity *= 1.0 - step(current_timing_offset, u_time * animation_speed_factor);
                 opacity *= clamp((step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            } else {
                current_timing_offset = timing_offset_intro;
                 opacity *= step(current_timing_offset, u_time * animation_speed_factor);
                 opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            }

            fragColor = vec4(color, opacity);
            fragColor.rgb *= fragColor.a;
        }`}
      uniforms={uniforms}
      maxFps={60}
    />
  );
};

const ShaderMaterial = ({
  source,
  uniforms,
  maxFps = 60,
}: {
  source: string;
  hovered?: boolean;
  maxFps?: number;
  uniforms: Uniforms;
}) => {
  const { size } = useThree();
  const ref = useRef<THREE.Mesh>(null);
  let lastFrameTime = 0;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const timestamp = clock.getElapsedTime();

    lastFrameTime = timestamp;

    const material: any = ref.current.material;
    const timeLocation = material.uniforms.u_time;
    timeLocation.value = timestamp;
  });

  const getUniforms = () => {
    const preparedUniforms: any = {};

    for (const uniformName in uniforms) {
      const uniform: any = uniforms[uniformName];

      switch (uniform.type) {
        case 'uniform1f':
          preparedUniforms[uniformName] = { value: uniform.value, type: '1f' };
          break;
        case 'uniform1i':
          preparedUniforms[uniformName] = { value: uniform.value, type: '1i' };
          break;
        case 'uniform3f':
          preparedUniforms[uniformName] = {
            value: new THREE.Vector3().fromArray(uniform.value),
            type: '3f',
          };
          break;
        case 'uniform1fv':
          preparedUniforms[uniformName] = { value: uniform.value, type: '1fv' };
          break;
        case 'uniform3fv':
          preparedUniforms[uniformName] = {
            value: uniform.value.map((v: number[]) =>
              new THREE.Vector3().fromArray(v),
            ),
            type: '3fv',
          };
          break;
        case 'uniform2f':
          preparedUniforms[uniformName] = {
            value: new THREE.Vector2().fromArray(uniform.value),
            type: '2f',
          };
          break;
        default:
          console.error(`Invalid uniform type for '${uniformName}'.`);
          break;
      }
    }

    preparedUniforms['u_time'] = { value: 0, type: '1f' };
    preparedUniforms['u_resolution'] = {
      value: new THREE.Vector2(size.width * 2, size.height * 2),
    };
    return preparedUniforms;
  };

  const material = React.useMemo(() => {
    const materialObject = new THREE.ShaderMaterial({
      vertexShader: `
      precision mediump float;
      in vec2 coordinates;
      uniform vec2 u_resolution;
      out vec2 fragCoord;
      void main(){
        float x = position.x;
        float y = position.y;
        gl_Position = vec4(x, y, 0.0, 1.0);
        fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution;
        fragCoord.y = u_resolution.y - fragCoord.y;
      }
      `,
      fragmentShader: source,
      uniforms: getUniforms(),
      glslVersion: THREE.GLSL3,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
    });

    return materialObject;
  }, [size.width, size.height, source]);

  return (
    <mesh ref={ref as any}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const Shader: React.FC<ShaderProps> = ({ source, uniforms, maxFps = 60 }) => {
  return (
    <Canvas className="absolute inset-0  h-full w-full">
      <ShaderMaterial source={source} uniforms={uniforms} maxFps={maxFps} />
    </Canvas>
  );
};

const AnimatedNavLink = ({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) => {
  const defaultTextColor = 'text-gray-300';
  const hoverTextColor = 'text-white';
  const textSizeClass = 'text-sm';

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (onClick) {
      onClick();
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className={`group relative inline-block overflow-hidden h-5 flex items-center ${textSizeClass}`}
    >
      <div className="flex flex-col transition-transform duration-400 ease-out transform group-hover:-translate-y-1/2">
        <span className={defaultTextColor}>{children}</span>
        <span className={hoverTextColor}>{children}</span>
      </div>
    </a>
  );
};

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, children }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-0 flex items-center justify-center z-50 px-4"
          >
            <div
              className="relative w-full max-w-lg backdrop-blur-md bg-[#1f1f1f57] border border-[#333] rounded-2xl p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Dialog Content Components
const AboutContent = () => (
  <div className="space-y-6 text-center">
    <h2 className="text-3xl font-bold text-white">About Our Journey</h2>
    <div className="space-y-4 text-white/70">
      <p>
        We are explorers of the digital frontier, seeking to unravel the
        mysteries of multi-agent systems.
      </p>
      <p>
        Our mission is to create intelligent systems that can work together,
        learn from each other, and push the boundaries of what's possible.
      </p>
      <p>
        Join us as we venture into the unknown, where thought meets code, and
        intelligence emerges from silence.
      </p>
    </div>
  </div>
);

const JourneyContent = () => (
  <div className="space-y-6">
    <h2 className="text-3xl font-bold text-white text-center">
      The Journey Ahead
    </h2>
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="w-2 h-2 bg-white rounded-full"></span>
          Phase 1: Discovery
        </h3>
        <p className="text-white/70 ml-4">
          Uncover the potential of multi-agent systems and explore the
          foundations of distributed intelligence.
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="w-2 h-2 bg-white/60 rounded-full"></span>
          Phase 2: Evolution
        </h3>
        <p className="text-white/70 ml-4">
          Watch as agents learn, adapt, and evolve together, creating emergent
          behaviors and collective intelligence.
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="w-2 h-2 bg-white/30 rounded-full"></span>
          Phase 3: Transcendence
        </h3>
        <p className="text-white/70 ml-4">
          Experience the emergence of new forms of intelligence as our agents
          transcend their original programming.
        </p>
      </div>
    </div>
  </div>
);

const ContactContent = () => {
  const handleLinkedInClick = () => {
    window.open('https://www.linkedin.com/in/islam-hachimi/', '_blank');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white text-center">
        Get in Touch
      </h2>
      <img src="face.jpeg" className="w-80 h-80 mx-auto" />
      <p className="text-white/70 text-center">
        I'm Islam HACHIMI, an AI explorer of the digital frontier, seeking to
        unravel the mysteries of multi-agent systems, and eating pizza along the
        way. Let's connect and explore the possibilities together.
      </p>
      <div className="pt-4">
        <button
          onClick={handleLinkedInClick}
          className="w-full rounded-full bg-white text-black font-medium py-3 hover:bg-white/90 transition-colors flex items-center justify-center gap-3"
        >
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          Connect on LinkedIn
        </button>
      </div>
      <p className="text-xs text-white/40 text-center pt-4">
        Let's connect on LinkedIn for professional networking and collaboration
        opportunities.
      </p>
    </div>
  );
};

function MiniNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [headerShapeClass, setHeaderShapeClass] = useState('rounded-full');
  const shapeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (shapeTimeoutRef.current) {
      clearTimeout(shapeTimeoutRef.current);
    }

    if (isOpen) {
      setHeaderShapeClass('rounded-xl');
    } else {
      shapeTimeoutRef.current = setTimeout(() => {
        setHeaderShapeClass('rounded-full');
      }, 300);
    }

    return () => {
      if (shapeTimeoutRef.current) {
        clearTimeout(shapeTimeoutRef.current);
      }
    };
  }, [isOpen]);

  const logoElement = <PlanetIcon />;

  const navLinksData = [
    { label: 'About', href: '#about' },
    { label: 'Journey', href: '#journey' },
    { label: 'Contact', href: '#contact' },
  ];

  const demoButtonElement = (
    <a href="https://www.youtube.com/watch?v=LXr5qbhwImc">
      <button className="px-4 py-2 sm:px-3 text-xs sm:text-sm border border-[#333] bg-[rgba(31,31,31,0.62)] text-gray-300 rounded-full hover:border-white/50 hover:text-white transition-colors duration-200 w-full sm:w-auto">
        Demo
      </button>
    </a>
  );

  const startButtonElement = (
    <div className="relative group w-full sm:w-auto">
      <div
        className="absolute inset-0 -m-2 rounded-full
                     hidden sm:block
                     bg-gray-100
                     opacity-40 filter blur-lg pointer-events-none
                     transition-all duration-300 ease-out
                     group-hover:opacity-60 group-hover:blur-xl group-hover:-m-3"
      ></div>
      <button className="relative z-10 px-4 py-2 sm:px-3 text-xs sm:text-sm font-semibold text-black bg-gradient-to-br from-gray-100 to-gray-300 rounded-full hover:from-gray-200 hover:to-gray-400 transition-all duration-200 w-full sm:w-auto">
        Start
      </button>
    </div>
  );

  const handleNavClick = (label: string) => {
    setActiveDialog(label.toLowerCase());
  };

  const getDialogContent = () => {
    switch (activeDialog) {
      case 'about':
        return <AboutContent />;
      case 'journey':
        return <JourneyContent />;
      case 'contact':
        return <ContactContent />;
      default:
        return null;
    }
  };

  return (
    <>
      <header
        className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-20
                         flex flex-col items-center
                         pl-6 pr-6 py-3 backdrop-blur-sm
                         ${headerShapeClass}
                         border border-[#333] bg-[#1f1f1f57]
                         w-[calc(100%-2rem)] sm:w-auto
                         transition-[border-radius] duration-0 ease-in-out`}
      >
        <div className="flex items-center justify-between w-full gap-x-6 sm:gap-x-8">
          <div className="flex items-center">{logoElement}</div>

          <nav className="hidden sm:flex items-center space-x-4 sm:space-x-6 text-sm">
            {navLinksData.map((link) => (
              <AnimatedNavLink
                key={link.href}
                href={link.href}
                onClick={() => handleNavClick(link.label)}
              >
                {link.label}
              </AnimatedNavLink>
            ))}
          </nav>

          <div className="hidden sm:flex items-center gap-2 sm:gap-3">
            {demoButtonElement}
            <a href="/chat">{startButtonElement}</a>
          </div>

          <button
            className="sm:hidden flex items-center justify-center w-8 h-8 text-gray-300 focus:outline-none"
            onClick={toggleMenu}
            aria-label={isOpen ? 'Close Menu' : 'Open Menu'}
          >
            {isOpen ? (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                ></path>
              </svg>
            )}
          </button>
        </div>

        <div
          className={`sm:hidden flex flex-col items-center w-full transition-all ease-in-out duration-300 overflow-hidden
                         ${isOpen ? 'max-h-[1000px] opacity-100 pt-4' : 'max-h-0 opacity-0 pt-0 pointer-events-none'}`}
        >
          <nav className="flex flex-col items-center space-y-4 text-base w-full">
            {navLinksData.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.label);
                  setIsOpen(false);
                }}
                className="text-gray-300 hover:text-white transition-colors w-full text-center"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex flex-col items-center space-y-4 mt-4 w-full">
            {demoButtonElement}
            <a href="/chat">{startButtonElement}</a>
          </div>
        </div>
      </header>

      <Dialog isOpen={!!activeDialog} onClose={() => setActiveDialog(null)}>
        {getDialogContent()}
      </Dialog>
    </>
  );
}

const LandingPage = ({ className }: PageProps) => {
  const [businessQuery, setBusinessQuery] = useState('');

  const handleBusinessQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (businessQuery) {
      const encodedQuery = encodeURIComponent(businessQuery);
      window.location.href = `/chat?query=${encodedQuery}`;
    }
  };

  return (
    <div
      className={cn(
        'flex w-[100%] flex-col min-h-screen bg-black relative',
        className,
      )}
    >
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0">
          <CanvasRevealEffect
            animationSpeed={3}
            containerClassName="bg-black"
            colors={[
              [255, 255, 255],
              [255, 255, 255],
            ]}
            dotSize={6}
            reverse={false}
          />
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,1)_0%,_transparent_100%)]" />
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 flex flex-col flex-1">
        {/* Top navigation */}
        <MiniNavbar />

        {/* Main content container */}
        <div className="flex flex-1 flex-col justify-center items-center px-4">
          <div className="w-full max-w-sm">
            <motion.div
              key="business-query-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="space-y-6 text-center"
            >
              <div className="space-y-3">
                <h1 className="text-[2.9rem] font-bold leading-[1.1] tracking-tight text-white">
                  agent cosm
                </h1>
                <h1 className="text-[1.2rem] text-white/70 font-light">
                  Discover Your Next Market -{'>'} Launch Your Business.
                </h1>
              </div>

              <div className="space-y-4">
                <form onSubmit={handleBusinessQuerySubmit}>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="What business are you curious about?"
                      value={businessQuery}
                      onChange={(e) => setBusinessQuery(e.target.value)}
                      className="w-full backdrop-blur-[1px] text-white border-1 border-white/10 rounded-full py-3 px-4 pr-12 focus:outline-none focus:border focus:border-white/30 text-center"
                      required
                    />
                    <button
                      type="submit"
                      className="absolute right-1.5 top-1.5 text-white w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors group overflow-hidden"
                    >
                      <span className="relative w-full h-full block overflow-hidden">
                        <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-full">
                          →
                        </span>
                        <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 -translate-x-full group-hover:translate-x-0">
                          →
                        </span>
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              <p className="text-xs text-white/40 pt-10">
                Let AI help you find unfulfilled needs and instantly scaffold
                and validate a business concept.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative z-10 py-6 px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0">
            <motion.a
              href="https://googlecloudmultiagents.devpost.com/?ref_feature=challenge&ref_medium=your-open-hackathons&ref_content=Submissions+open"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/50 hover:text-white transition-colors text-sm flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <span>
                Submission for Google Cloud's Agent Development Kit Hackathon
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </motion.a>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default function Page() {
  return <LandingPage />;
}
