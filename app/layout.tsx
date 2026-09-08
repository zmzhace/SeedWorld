import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'SeedWorld · 小说世界推演',
  description: '从世界资料、动态图谱和角色推演生成逻辑一致的小说章节。',
}

export const viewport = { themeColor: '#f6f5f1' }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" className={inter.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
