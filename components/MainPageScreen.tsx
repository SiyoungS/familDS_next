'use client';

import { circlePositions, getRandomDelay, linePositions } from '@/lib/ralation-analysis-pages/motion-variants';
import { motion, scale, Variants } from 'framer-motion';

// animation variants
const rootContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.5 },
  },
};
const cardVariants:Variants = {
  hidden: { opacity: 0, scale: 0 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.8,
      delay: 1.5
    }
  }
};
const lineVariants: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { 
      duration: 1, 
      ease: "easeInOut", 
      delay: getRandomDelay(0.5, 1)
    }
  }
};
export default function RelationAnalysisPage() {

  return (
    <motion.div 
    variants={rootContainerVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: false, margin: "-10%" }}
    className="relative flex h-screen w-full items-center justify-center bg-[#f8f9fa] overflow-hidden p-6">
      {/* 배경 네트워크 그래픽 요소를 시뮬레이션한 추상화 데코레이션 */}
      <div className="absolute flex items-center justify-center w-0 h-0 z-0">
        <svg 
          className="absolute min-w-[1200px] min-h-[1200px] w-[1200px] h-[1200px] opacity-100 pointer-events-none
          main-page-svgs" 
          viewBox="0 0 1000 500"
        >
          {/* 연결 실선 (연한 민트색 두께 1px) */}
          <g>
            {linePositions.map((line, index) => (
              <motion.line 
              key={`main-page-screen-line-${index}`}
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                visible: {
                  pathLength: 1,
                  opacity: 1,
                  transition: { 
                    duration: 1, 
                    ease: "easeInOut", 
                    delay: getRandomDelay(0.5, 1)
                  }
                }
              }}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              className={line.className}
              />
            ))}
          </g>

          {/* 원형 노드 포인트 (크기별 정밀 배치) */}
          <g className="fill-[#00c7ae]/60">
            {circlePositions.map((node, index) => (
              <motion.circle
              key={`main-page-screen-circle-${index}`}
              variants={{
                hidden: { scale: 0, opacity: 0 },
                visible: {
                  scale: 1,
                  opacity: 1,
                  transition: { duration: 0.5, ease: "easeInOut", delay: getRandomDelay(0, 0.5) }
                }
              }}
              cx={node.cx}
              cy={node.cy}
              r={node.r}
              className={node.className}
              />
            ))}
          </g>
        </svg>
      </div>

      {/* 중앙 카드 대시보드 */}

      <motion.div 
      variants={cardVariants}
      className="relative z-10 w-full max-w-85 rounded-3xl bg-white/10 p-10 
        shadow-[0_10px_35px_rgba(0,0,0,0.03)] 
        border border-white/20 
        backdrop-blur-sm flex flex-col items-center text-center">
        <div className="mb-5 text-[#00c7ae]">
          <svg className="h-7 w-7 fill-current" viewBox="0 0 24 24">
            <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">
          AI 관계망 분석
        </h2>
        
        <p className="text-[15px] leading-relaxed text-gray-400 font-medium tracking-tight">
          상담 데이터를 기반으로 <br />
          가계도와 생태도를 생성합니다.
        </p>
      </motion.div>
    </motion.div>
  );
}
