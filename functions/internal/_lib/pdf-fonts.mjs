import fontkit from '@pdf-lib/fontkit';
import { StandardFonts } from 'pdf-lib';
export async function loadPdfAssets(env) {
  const read=async path=>{try{const request=new Request(`https://windowsbyclearview.com${path}`);const response=env?.ASSETS?await env.ASSETS.fetch(request):await fetch(request,{signal:AbortSignal.timeout(3000)});return response.ok?new Uint8Array(await response.arrayBuffer()):undefined;}catch{return undefined;}};
  const [fontBytes,boldFontBytes,logoBytes]=await Promise.all([read('/fonts/NotoSans-Regular.ttf'),read('/fonts/NotoSans-Bold.ttf'),read('/logo/lockup-on-white.png')]);
  return {fontBytes,boldFontBytes,logoBytes};
}
export async function embedPdfFonts(pdf,assets={}) {
  if(assets.fontBytes){pdf.registerFontkit(fontkit);return {regular:await pdf.embedFont(assets.fontBytes,{subset:true}),bold:await pdf.embedFont(assets.boldFontBytes||assets.fontBytes,{subset:true})};}
  return {regular:await pdf.embedFont(StandardFonts.Helvetica),bold:await pdf.embedFont(StandardFonts.HelveticaBold)};
}
