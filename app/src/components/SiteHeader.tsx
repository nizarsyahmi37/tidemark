'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
const links=[['/explore','Investigate'],['/upload','Upload data'],['/#examples','Examples'],['/about','About']] as const;
export default function SiteHeader(){const path=usePathname();return <header className="nav site-nav"><Link className="brand" href="/">Tidemark</Link><nav className="navlinks" aria-label="Main navigation">{links.map(([href,label])=><Link key={href} href={href} aria-current={path===href?'page':undefined}>{label}</Link>)}<ThemeToggle/></nav></header>}
