/* WeedTracker Pilot V52 – seeds & data tools */

function chemicalsSeed(){
  return [
    {name:'Crucial', active:'Glyphosate', qty:60},
    {name:'Bow-Saw', active:'Triclopyr + Picloram', qty:20},
    {name:'Grazon', active:'Triclopyr + Picloram', qty:18},
    {name:'SuperWet', active:'Non-ionic surfactant', qty:10},
    {name:'Uptake', active:'Methylated seed oil', qty:8},
    {name:'Hastings', active:'2,4-D', qty:12},
    {name:'Sword 750 WG', active:'Metsulfuron-methyl', qty:6},
    {name:'Atrazine 900 WG', active:'Atrazine', qty:9},
    {name:'Collide 700', active:'Imazapyr', qty:5},
    {name:'Extreme Marking Foam', active:'Foaming agent', qty:3},
    {name:'Dicamba', active:'Dicamba', qty:5},
    {name:'MCPA', active:'MCPA', qty:5},
    {name:'AAlia 700', active:'Aminopyralid', qty:3},
    {name:'Granular', active:'Soil residual (simazine/atrazine)', qty:12},
    {name:'Ramset', active:'Adjuvant / penetrant', qty:4}
  ];
}

function weedsSeed(){
  // Noxious pinned first (no labels shown in UI)
  return [
    // Noxious (examples from NSW handbook set)
    {name:'African Lovegrass (Eragrostis curvula)', noxious:true},
    {name:'Cape Broom (Genista monspessulana)', noxious:true},
    {name:'Blackberry (Rubus fruticosus agg.)', noxious:true},
    {name:'Serrated Tussock (Nassella trichotoma)', noxious:true},
    {name:'St John’s Wort (Hypericum perforatum)', noxious:true},
    {name:'Bathurst Burr (Xanthium spinosum)', noxious:true},
    {name:'Chilean Needle Grass (Nassella neesiana)', noxious:true},
    {name:'Paterson’s Curse (Echium plantagineum)', noxious:true},
    {name:'Sweet Briar (Rosa rubiginosa)', noxious:true},
    {name:'Skeleton Weed (Chondrilla juncea)', noxious:true},
    {name:'Cape Ivy (Delairea odorata)', noxious:true},
    {name:'Scotch Broom (Cytisus scoparius)', noxious:true},
    {name:'Watsonia (Watsonia spp.)', noxious:true},
    {name:'Fireweed (Senecio madagascariensis)', noxious:true},
    // Others
    {name:'Fleabane (Conyza spp.)', noxious:false},
    {name:'Ryegrass (Lolium spp.)', noxious:false},
    {name:'Wild Oats (Avena fatua)', noxious:false},
    {name:'Wild Radish (Raphanus raphanistrum)', noxious:false},
    {name:'Clover (Trifolium spp.)', noxious:false}
  ];
}

const dataTools = {
  clearData(){
    if(!confirm('This will clear JOBS & BATCHES (chemicals & weeds stay). Continue?')) return;
    localStorage.removeItem('wt:jobs'); localStorage.removeItem('wt:batches');
    alert('Cleared job & batch data.');
  },

  seedDemo(force=false){
    if(!force && (store.get('wt:jobs')||[]).length>0) return;
    const now = new Date();
    const isoLocal = d=>{ const c=new Date(d); c.setMinutes(c.getMinutes()-c.getTimezoneOffset()); return c.toISOString().slice(0,16); };
    const j1 = {
      id: Date.now()-100000, name:'WombatRoad 20251011 S', councilNo:'',
      type:'Spot Spray', location:'Wombat Road',
      start: isoLocal(new Date(now.getTime()-3600*1000)), stop: isoLocal(now),
      weed:'African Lovegrass (Eragrostis curvula)', batchId:'101',
      notes:'Sample record', lat:-35.281, lng:149.128, photo:null,
      status:'complete', createdAt: new Date().toISOString(), lastEdited:new Date().toISOString(), linked:[]
    };
    const j2 = {
      id: Date.now()-50000, name:'CapeBroomReserve 20251010 I', councilNo:'',
      type:'Inspection', location:'Cape Broom Reserve',
      start: isoLocal(now), stop:'',
      weed:'Cape Broom (Genista monspessulana)', batchId:'',
      notes:'', lat:-33.87, lng:151.21, photo:null,
      status:'draft', createdAt:new Date().toISOString(), lastEdited:new Date().toISOString(), linked:[]
    };
    store.set('wt:jobs', [j1,j2]);

    const b1 = {
      id:'101', totalL:1600, remaining:1400,
      chems:[
        {name:'Crucial', rate:2.0, totalUsed:32},
        {name:'Sword 750 WG', rate:0.02, totalUsed:0.32},
        {name:'SuperWet', rate:0.3, totalUsed:4.8}
      ],
      jobIds:[j1.id],
      createdAt:new Date().toISOString(),
      lastEdited:new Date().toISOString()
    };
    store.set('wt:batches', [b1]);
  }
};
