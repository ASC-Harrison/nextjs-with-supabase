import { ImageResponse } from 'next/og';
export const size={width:1200,height:630};export const contentType='image/png';
export default function Image(){return new ImageResponse(<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',padding:80,background:'#080d18',color:'white',fontFamily:'sans-serif'}}><div style={{fontSize:68,fontWeight:900}}>Financial <span style={{color:'#60a5fa'}}>Control Center</span></div><div style={{fontSize:30,color:'#94a3b8',marginTop:20}}>Wedding · Debt · Savings · Budget</div></div>,size)}
