import React from 'react';
import {SquaresFour,EnvelopeSimple,Strategy,ArrowsLeftRight,List} from '@phosphor-icons/react';
const items=[['dashboard','Tổng quan',SquaresFour],['inbox','Hộp thư',EnvelopeSimple],['tactics','Chiến thuật',Strategy],['transfers','Chuyển nhượng',ArrowsLeftRight]];
export default function MobileNavigation({page,onNavigate,onMenu,hidden}){
 if(hidden)return null;
 return <nav className="mobile-bottom-nav" aria-label="Điều hướng nhanh">{items.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} aria-current={page===id?'page':undefined} onClick={()=>onNavigate(id)}><Icon size={23} weight={page===id?'fill':'regular'}/><span>{label}</span></button>)}<button onClick={onMenu}><List size={23}/><span>Thêm</span></button></nav>;
}
