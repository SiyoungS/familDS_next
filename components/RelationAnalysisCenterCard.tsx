import { motion, Variants } from "framer-motion";

export const cardVariantsInit:Variants = {
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
export const cardVariants:Variants = {
  hidden: { opacity: 0, scale: 0 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      delay: 0
    }
  }
};
export default function RelationAnalysisCenterCard(props: {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  variants?: Variants;
}) {
  return (
    <motion.div 
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10%" }}
      variants={props.variants}
      className="relative z-10 w-full max-w-85 rounded-3xl bg-white/10 p-10 
        shadow-[0_10px_35px_rgba(0,0,0,0.03)] 
        border border-white/20 
        backdrop-blur-sm flex flex-col items-center text-center">
        <div className="mb-4 inline-flex items-center justify-center p-2.5 rounded-2xl bg-[#10b981]/10 text-[#10b981]">
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

        {!props.isMenuOpen && (

          <button
            onClick={() => props.setIsMenuOpen(true)}
            className="mt-5 w-full flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-xl bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] text-xs font-bold transition-all"
          >
            <span>상담 데이터 입력하기</span>
            <svg className="w-3.5 h-3.5 animate-bounce-horizontal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        )}
        
      </motion.div>
  )
}