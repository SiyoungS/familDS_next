import { Variants } from "framer-motion";

export const getRandomDelay = (min:number, max:number):number => 
  Math.random() * (max - min) + min;

export const lineVariants: Variants = {
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

export const linePositions: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  className: "line-main" | "line-thin";
}[] = [
  { x1: 150, y1: 30, x2: 162, y2: 75, className: "line-thin" },
  { x1: 162, y1: 75, x2: 112, y2: 105, className: "line-thin" },
  { x1: 112, y1: 105, x2: 150, y2: 30, className: "line-thin" },
  { x1: 112, y1: 105, x2: 173, y2: 280, className: "line-thin" },
  { x1: 162, y1: 75, x2: 173, y2: 280, className: "line-thin" },
  { x1: 150, y1: 30, x2: 292, y2: 52, className: "line-thin" },
  { x1: 150, y1: 30, x2: 316, y2: 92, className: "line-thin" },
  { x1: 150, y1: 30, x2: 265, y2: 120, className: "line-thin" },
  { x1: 150, y1: 30, x2: 216, y2: 162, className: "line-thin" },
  { x1: 150, y1: 30, x2: 252, y2: 230, className: "line-thin" },
  { x1: 150, y1: 30, x2: 293, y2: 140, className: "line-thin" },
  { x1: 112, y1: 105, x2: 292, y2: 52, className: "line-thin" },
  { x1: 112, y1: 105, x2: 316, y2: 92, className: "line-thin" },
  { x1: 112, y1: 105, x2: 265, y2: 120, className: "line-thin" },
  { x1: 112, y1: 105, x2: 216, y2: 162, className: "line-thin" },
  { x1: 112, y1: 105, x2: 252, y2: 230, className: "line-thin" },
  { x1: 112, y1: 105, x2: 293, y2: 140, className: "line-thin" },
  { x1: 162, y1: 75, x2: 292, y2: 52, className: "line-thin" },
  { x1: 162, y1: 75, x2: 316, y2: 92, className: "line-thin" },
  { x1: 162, y1: 75, x2: 265, y2: 120, className: "line-thin" },
  { x1: 162, y1: 75, x2: 216, y2: 162, className: "line-thin" },
  { x1: 162, y1: 75, x2: 252, y2: 230, className: "line-thin" },
  { x1: 162, y1: 75, x2: 293, y2: 140, className: "line-thin" },
  { x1: 173, y1: 280, x2: 292, y2: 52, className: "line-thin" },
  { x1: 173, y1: 280, x2: 316, y2: 92, className: "line-thin" },
  { x1: 173, y1: 280, x2: 265, y2: 120, className: "line-thin" },
  { x1: 173, y1: 280, x2: 216, y2: 162, className: "line-thin" },
  { x1: 173, y1: 280, x2: 252, y2: 230, className: "line-thin" },
  { x1: 173, y1: 280, x2: 293, y2: 140, className: "line-thin" },
  { x1: 292, y1: 52, x2: 316, y2: 92, className: "line-thin" },
  { x1: 316, y1: 92, x2: 293, y2: 140, className: "line-thin" },
  { x1: 293, y1: 140, x2: 265, y2: 120, className: "line-thin" },
  { x1: 265, y1: 120, x2: 292, y2: 52, className: "line-thin" },
  { x1: 292, y1: 52, x2: 252, y2: 230, className: "line-thin" },
  { x1: 252, y1: 230, x2: 275, y2: 225, className: "line-thin" },
  { x1: 275, y1: 225, x2: 293, y2: 140, className: "line-thin" },
  { x1: 265, y1: 120, x2: 216, y2: 162, className: "line-thin" },
  { x1: 216, y1: 162, x2: 252, y2: 230, className: "line-thin" },
  { x1: 265, y1: 120, x2: 306, y2: 178, className: "line-thin" },
  { x1: 306, y1: 178, x2: 272, y2: 250, className: "line-thin" },
  { x1: 272, y1: 250, x2: 292, y2: 52, className: "line-thin" },
  { x1: 272, y1: 250, x2: 202, y2: 380, className: "line-thin" },
  { x1: 272, y1: 250, x2: 222, y2: 450, className: "line-thin" },
  { x1: 272, y1: 250, x2: 215, y2: 495, className: "line-thin" },
  { x1: 272, y1: 250, x2: 323, y2: 385, className: "line-thin" },
  { x1: 272, y1: 250, x2: 250, y2: 480, className: "line-thin" },
  { x1: 292, y1: 52, x2: 201, y2: 492, className: "line-thin" },
  { x1: 173, y1: 280, x2: 202, y2: 380, className: "line-thin" },
  { x1: 202, y1: 380, x2: 222, y2: 450, className: "line-thin" },
  { x1: 222, y1: 450, x2: 215, y2: 495, className: "line-thin" },
  { x1: 202, y1: 380, x2: 250, y2: 360, className: "line-thin" },
  { x1: 250, y1: 360, x2: 323, y2: 385, className: "line-thin" },
  { x1: 323, y1: 385, x2: 250, y2: 480, className: "line-thin" },
  { x1: 250, y1: 480, x2: 222, y2: 450, className: "line-thin" },
  { x1: 222, y1: 450, x2: 201, y2: 492, className: "line-thin" },
  { x1: 252, y1: 230, x2: 475, y2: 182, className: "line-thin" },
  { x1: 275, y1: 225, x2: 400, y2: 295, className: "line-thin" },
  { x1: 400, y1: 295, x2: 475, y2: 182, className: "line-thin" },
  { x1: 400, y1: 295, x2: 451, y2: 390, className: "line-thin" },
  { x1: 451, y1: 390, x2: 475, y2: 182, className: "line-thin" },
  { x1: 451, y1: 390, x2: 415, y2: 432, className: "line-thin" },
  { x1: 415, y1: 432, x2: 465, y2: 415, className: "line-thin" },
  { x1: 451, y1: 390, x2: 465, y2: 415, className: "line-thin" },
  { x1: 400, y1: 295, x2: 465, y2: 415, className: "line-thin" },
  { x1: 475, y1: 182, x2: 465, y2: 415, className: "line-thin" },
  { x1: 202, y1: 380, x2: 465, y2: 415, className: "line-thin" },
  { x1: 173, y1: 280, x2: 465, y2: 415, className: "line-thin" },
  { x1: 568, y1: 265, x2: 748, y2: 110, className: "line-main" },
  { x1: 568, y1: 265, x2: 648, y2: 215, className: "line-main" },
  { x1: 648, y1: 215, x2: 748, y2: 110, className: "line-main" },
  { x1: 748, y1: 110, x2: 770, y2: 148, className: "line-main" },
  { x1: 770, y1: 148, x2: 648, y2: 215, className: "line-main" },
  { x1: 648, y1: 215, x2: 633, y2: 278, className: "line-main" },
  { x1: 633, y1: 278, x2: 568, y2: 265, className: "line-main" },
  { x1: 633, y1: 278, x2: 743, y2: 380, className: "line-main" },
  { x1: 748, y1: 110, x2: 901, y2: 78, className: "line-thin" },
  { x1: 901, y1: 78, x2: 770, y2: 148, className: "line-thin" },
  { x1: 770, y1: 148, x2: 831, y2: 260, className: "line-thin" },
  { x1: 831, y1: 260, x2: 743, y2: 380, className: "line-thin" },
  { x1: 743, y1: 380, x2: 878, y2: 430, className: "line-thin" },
  { x1: 831, y1: 260, x2: 878, y2: 430, className: "line-thin" },
  { x1: 475, y1: 182, x2: 568, y2: 265, className: "line-thin" },
  { x1: 548, y1: 315, x2: 568, y2: 265, className: "line-thin" },
  { x1: 548, y1: 315, x2: 633, y2: 278, className: "line-thin" },
  { x1: 548, y1: 315, x2: 451, y2: 390, className: "line-thin" },
  { x1: 548, y1: 315, x2: 400, y2: 295, className: "line-thin" },
  { x1: 568, y1: 265, x2: 550, y2: 290, className: "line-thin" },
  { x1: 550, y1: 290, x2: 633, y2: 278, className: "line-thin" },
  { x1: 748, y1: 110, x2: 785, y2: 102, className: "line-thin" },
  { x1: 785, y1: 102, x2: 901, y2: 78, className: "line-thin" },
  { x1: 785, y1: 102, x2: 770, y2: 148, className: "line-thin" },
  { x1: 648, y1: 215, x2: 678, y2: 210, className: "line-thin" },
  { x1: 678, y1: 210, x2: 770, y2: 148, className: "line-thin" },
  { x1: 678, y1: 210, x2: 831, y2: 260, className: "line-thin" },
  { x1: 678, y1: 210, x2: 688, y2: 225, className: "line-thin" },
  { x1: 633, y1: 278, x2: 716, y2: 362, className: "line-thin" },
  { x1: 716, y1: 362, x2: 743, y2: 380, className: "line-thin" },
  { x1: 716, y1: 362, x2: 831, y2: 260, className: "line-thin" },
  { x1: 572, y1: 340, x2: 633, y2: 278, className: "line-thin" },
  { x1: 572, y1: 340, x2: 548, y2: 315, className: "line-thin" },
  { x1: 572, y1: 340, x2: 716, y2: 362, className: "line-thin" }
];

export const circlePositions: {
  cx: number;
  cy: number;
  r: number;
  className: "node-large" | "node-medium" | "node-small" | "node-tiny";
}[] = [
  // 좌측 영역 노드
  { cx: 162, cy: 75, r: 14, className: "node-large" },
  { cx: 112, cy: 105, r: 9, className: "node-medium" },
  { cx: 150, cy: 30, r: 4, className: "node-tiny" },
  { cx: 173, cy: 280, r: 10, className: "node-medium" },
  { cx: 202, cy: 380, r: 6, className: "node-small" },

  { cx: 222, cy: 450, r: 8, className: "node-medium" },
  { cx: 215, cy: 495, r: 5, className: "node-small" },
  { cx: 201, cy: 492, r: 3, className: "node-tiny" },
  { cx: 250, cy: 480, r: 4.5, className: "node-small" },
  { cx: 323, cy: 385, r: 7.5, className: "node-medium" },

  { cx: 250, cy: 360, r: 4, className: "node-tiny" },

  // 좌측 내부 구조 소형 노드
  { cx: 292, cy: 52, r: 4, className: "node-tiny" },
  { cx: 316, cy: 92, r: 6, className: "node-small" },
  { cx: 293, cy: 140, r: 5, className: "node-small" },
  { cx: 265, cy: 120, r: 3.5, className: "node-tiny" },
  { cx: 216, cy: 162, r: 3.5, className: "node-tiny" },

  { cx: 252, cy: 230, r: 4.5, className: "node-small" },
  { cx: 275, cy: 225, r: 3, className: "node-tiny" },
  { cx: 306, cy: 178, r: 4, className: "node-tiny" },
  { cx: 272, cy: 250, r: 3.5, className: "node-tiny" },

  // 브릿지 영역 노드
  { cx: 475, cy: 182, r: 6.5, className: "node-medium" },
  { cx: 400, cy: 295, r: 7.5, className: "node-medium" },
  { cx: 451, cy: 390, r: 5.5, className: "node-small" },
  { cx: 415, cy: 432, r: 5, className: "node-small" },
  { cx: 465, cy: 415, r: 3.5, className: "node-tiny" },

  { cx: 548, cy: 315, r: 5.5, className: "node-small" },
  { cx: 550, cy: 290, r: 3, className: "node-tiny" },
  { cx: 572, cy: 340, r: 3, className: "node-tiny" },

  // 우측 메인 영역 노드
  { cx: 568, cy: 265, r: 13, className: "node-large" },
  { cx: 648, cy: 215, r: 5, className: "node-small" },
  { cx: 633, cy: 278, r: 6.5, className: "node-medium" },
  { cx: 748, cy: 110, r: 11, className: "node-large" },
  { cx: 770, cy: 148, r: 6.5, className: "node-medium" },

  { cx: 743, cy: 380, r: 10.5, className: "node-large" },

  // 우측 소형 노드 및 외곽 노드
  { cx: 901, cy: 78, r: 7.5, className: "node-medium" },
  { cx: 785, cy: 102, r: 5, className: "node-small" },
  { cx: 678, cy: 210, r: 4.5, className: "node-small" },
  { cx: 688, cy: 225, r: 3, className: "node-tiny" },
  { cx: 831, cy: 260, r: 5, className: "node-small" },

  { cx: 878, cy: 430, r: 7.5, className: "node-medium" },
  { cx: 716, cy: 362, r: 4, className: "node-tiny" }
]