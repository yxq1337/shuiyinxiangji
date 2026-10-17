import React from 'react';
import { motion } from 'motion/react';

interface RevealProps {
  children: React.ReactNode;
  /** 延迟毫秒，用于列表错落出现 */
  delay?: number;
  className?: string;
  /** React 列表 key（透传，仅用于列表渲染） */
  key?: React.Key;
}

/**
 * 元素进入视口时优雅渐显：opacity 0→1 + translateY(24px)→0
 * easeOutExpo 缓动 cubic-bezier(0.16, 1, 0.3, 1)，时长 600ms，只播放一次。
 */
export default function Reveal({ children, delay = 0, className }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}
