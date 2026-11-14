'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { historyRead } from '@/lib/ux';
type Item={id:string;title:string;href:string;date:string};
export default function RecentInvestigations(){const [items,setItems]=useState<Item[]>([]);useEffect(()=>setItems(historyRead()),[]);const remove=(id:string)=>{const next=items.filter(x=>x.id!==id);setItems(next);try{localStorage.setItem('tidemark-history',JSON.stringify(next))}catch{/* storage unavailable */}};if(!items.length)return null;return <section className="section"><h2>Recent investigations</h2><div className="grid">{items.map(x=><article className="card" key={x.id}><h3>{x.title}</h3><p className="muted">{new Date(x.date).toLocaleDateString()}</p><Link className="btn" href={x.href}>Re-open</Link> <button className="text-button" onClick={()=>remove(x.id)}>Delete</button></article>)}</div></section>}
