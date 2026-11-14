'use client';import dynamic from 'next/dynamic';const PlaceMap=dynamic(()=>import('./PlaceMap'),{ssr:false,loading:()=> <div className="card">Loading map…</div>});export default PlaceMap;
