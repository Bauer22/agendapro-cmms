export default function Loading() {
  return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#060d1a'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:'48px',marginBottom:'12px'}}>⚙️</div>
        <div style={{color:'#00d4ff',fontFamily:'system-ui',fontSize:'14px'}}>Carregando...</div>
      </div>
    </div>
  )
}
