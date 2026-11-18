/* CAST / SIGNAL / online content bridge — public read-only, no authentication or edit controls. */
(() => {
  const clone = obj => JSON.parse(JSON.stringify(obj));
  let published = {"version":5,"site":{"title":"キャラクターと、物語の保管庫。","intro":"ここはオリジナルキャラクターと、彼らが生きる物語を集めた個人アーカイブです。気になるキャラクターを見つけたら、プロフィールや出演作品を覗いてみてください。zetaで遊べるキャラクターもいます。","imagePolicy":"当サイトの掲載画像は、自作発言をせず、非商用の個人的な鑑賞・保存の範囲であれば保存していただいて構いません。画像の転載・再配布、商用利用は別途ご相談ください。画像にはAI生成サービスを利用したものを含みます。第三者の権利や各サービスの規約が優先される場合があります。","fanPolicy":"キャラクターのファンアート・二次創作・感想は大歓迎！ぜひ見せてください。投稿するときは専用FAタグ（設定している場合）を使ってもらえると嬉しいです。商用利用や第三者の権利に関わる場合は事前に確認してください。","screenshotPolicy":"zetaでのトークスクリーンショットやプレイ感想も大歓迎です！SNSで共有する際は、個人情報や他の方の会話内容が写り込まないようにご注意ください。zetaの利用規約・公開ガイドラインに従い、共有できる範囲でお楽しみください。","faTag":"","xUrl":"","zetaUrl":"","newDays":14},"tags":[{"id":"t-01","label":"幼馴染"},{"id":"t-02","label":"溺愛"},{"id":"t-03","label":"デザイナー"},{"id":"t-04","label":"二面性"},{"id":"t-05","label":"人外"},{"id":"t-06","label":"狼"},{"id":"t-07","label":"自由"},{"id":"t-08","label":"GRADE-X"},{"id":"t-09","label":"設定準備中"}],"worlds":[{"id":"rosier","title":"ロジエ邸","subtitle":"希少種の君に、保護のご案内。","summary":"世界的デザイナーの屋敷で育った希少獣人と、彼らを取り巻く人々の物語。","category":"FANTASY / ROMANCE","accent":"#f85861","image":"assets/orphe.png","link":"","stories":[{"title":"希少種の君に、保護のご案内。","label":"MAIN STORY","description":"国家保護通知から始まる、希少獣人とロジエ邸の物語。","url":""}]},{"id":"zero","title":"零号施設","subtitle":"第零収容研究所","summary":"国家研究資源とされた人外を収容する、最高危険度の研究施設。","category":"DARK SCI-FI","accent":"#269ffb","image":"assets/rov.png","link":"https://zeta-ai.io/ja/plots/72938678-04eb-4093-9dbd-3cb7dea91d7e/profile","stories":[]},{"id":"original","title":"ORIGINAL PROJECT","subtitle":"オリジナルキャラクター","summary":"まだ名前のないキャラクターたちのためのアーカイブ。","category":"PERSONAL / OC","accent":"#9967fa","image":"assets/unnamed.png","link":"","stories":[]}],"characters":[{"id":"orphe","name":"オルフェ・ロジエ","reading":"おるふぇ・ろじえ","roman":"ORPHE","surname":"ROSIER","type":"WORLD-CLASS DESIGNER","roleJa":"世界的ファッションデザイナー","hook":"その才能は、たった一人を美しく飾るために。","intro":"華やかで、自由奔放で、気まぐれ。世界を魅了する天才デザイナーには、どうしても特別扱いしたい幼馴染がいる。","age":"22","height":"184 cm","species":"人間","personality":"無邪気に甘えてみせる享楽家であり、頭の回転が速い合理主義者。笑顔のまま冷徹な決断を下すこともある。幼馴染にはどこまでも贔屓がち。","artwork":"assets/orphe.png","icon":"","iconPosition":30,"colors":{"accent":"#fa555d","soft":"#ffb5a6","deep":"#4e141b","bright":"#ff7073"},"worldIds":["rosier"],"tagIds":["t-01","t-02","t-03","t-04"],"playable":true,"works":[{"title":"希少種の君に、保護のご案内。","url":""}],"links":[],"gallery":[],"fields":[{"label":"職業","value":"世界的ファッションデザイナー"}],"published":true},{"id":"rov","name":"ロヴ","reading":"ろゔ","roman":"ROV","surname":"GRADE–X","type":"CONTAINMENT / GRADE–X","roleJa":"最危険収容個体","hook":"噛みちぎれないのは、拘束具じゃない。","intro":"危険度最高等級の人外。強靭な牙と身体能力を持ちながら、施設での自由は奪われたまま。自分の意志だけは、誰にも渡さない。","age":"20","height":"178 cm","species":"人外 / 狼耳・角","personality":"自然体でマイペース。欲求と興味に素直で、理不尽な強制を嫌う。怒鳴るより静かに決断し、束縛そのものではなく自分を閉じ込める施設を敵視する。","artwork":"assets/rov.png","icon":"","iconPosition":25,"colors":{"accent":"#199ef9","soft":"#a3e4ff","deep":"#092346","bright":"#20b7ff"},"worldIds":["zero"],"tagIds":["t-05","t-06","t-07","t-08"],"playable":true,"works":[{"title":"第零収容研究所／零号施設","url":"https://zeta-ai.io/ja/plots/72938678-04eb-4093-9dbd-3cb7dea91d7e/profile"}],"links":[],"gallery":[],"fields":[{"label":"危険度","value":"GRADE-X"}],"published":true},{"id":"unnamed","name":"名前未定","roman":"UNNAMED","surname":"O.C. / 03","type":"ORIGINAL / UNREGISTERED","roleJa":"オリジナルキャラクター","hook":"名前も物語も、これから。","intro":"紫のジャケットに身を包んだオリジナルキャラクター。詳しいプロフィールは制作中。","age":"","height":"","species":"","personality":"設定準備中。","artwork":"assets/unnamed.png","icon":"","iconPosition":23,"colors":{"accent":"#8e65fb","soft":"#c6bdff","deep":"#231742","bright":"#af7aff"},"worldIds":["original"],"tagIds":["t-09"],"playable":false,"works":[],"links":[],"gallery":[],"fields":[],"published":true}]};
  const sources = ['site','tags','worlds','characters'];
  async function load(){
    try {
      const values=await Promise.all(sources.map(async key=>{
        const response=await fetch(`content/${key}.json`,{cache:'no-store'});
        if(!response.ok)throw new Error(`Cannot load ${key}: HTTP ${response.status}`);
        return await response.json();
      }));
      const [site,tags,worlds,characters]=values;
      if(!site||!Array.isArray(tags)||!Array.isArray(worlds)||!Array.isArray(characters))throw new Error('Invalid JSON content');
      // Public site does not receive admin credentials. Never embed secrets or unpublished art in this repository.
      published={version:5,site,tags,worlds,characters};
    } catch(e){
      console.error('CAST / SIGNAL: unable to load published data',e);
      // A visible error rather than silently rendering bogus sample data.
      const node=document.createElement('div');
      node.setAttribute('role','alert');
      node.style.cssText='position:fixed;z-index:99999;inset:auto 10px 10px;background:#ffe88b;color:#121212;padding:14px;border:3px solid #121212;font:700 13px/1.5 sans-serif;';
      node.textContent='サイト情報の読み込みに失敗しました。ページを再読み込みしてください。';
      if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>document.body.append(node),{once:true}); else document.body.append(node);
    }
  }
  window.CAST_DATA={initial:published,clone,getPublished:()=>clone(published),getDraft:()=>clone(published)};
  window.CAST_DATA_READY=load();
})();
