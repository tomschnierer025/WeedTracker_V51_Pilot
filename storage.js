/* WeedTracker V52.1 – seeds & data tools (chemicals, weeds, clear/demo) */

function chemicalsSeed(){
  return [
    {name:'Crucial', active:'Glyphosate', qty:20},
    {name:'Bow-Saw', active:'Triclopyr + Picloram', qty:10},
    {name:'Grazon', active:'Triclopyr + Picloram', qty:8},
    {name:'SuperWet', active:'Non-ionic surfactant', qty:5},
    {name:'Uptake', active:'Methylated seed oil', qty:4},
    {name:'Hastings', active:'2,4-D', qty:6},
    {name:'Sword 750 WG', active:'Metsulfuron-methyl', qty:2},
    {name:'Atrazine 900 WG', active:'Atrazine', qty:3},
    {name:'Collide 700', active:'Imazapyr', qty:2},
    {name:'Extreme Marking Foam', active:'Foaming agent', qty:1},
    {name:'Dicamba', active:'3,6-Dichloro-o-anisic acid', qty:2},
    {name:'MCPA', active:'4-Chloro-2-methylphenoxyacetic acid', qty:2},
    {name:'AAlia 700', active:'Aminopyralid', qty:1.5},
    {name:'Granular', active:'Soil residual (simazine/atrazine)', qty:5},
    {name:'Ramset', active:'Adjuvant / penetrant', qty:2}
  ];
}

function weedsSeed(){
  return [
    {name:'African Lovegrass (Eragrostis curvula)', noxious:true},
    {name:'Cape Broom (Genista monspessulana)', noxious:true},
    {name:'Blackberry (Rubus fruticosus agg.)', noxious:true},
    {name:'Serrated Tussock (Nassella trichotoma)', noxious:true},
    {name:'St John’s Wort (Hypericum perforatum)', noxious:true},
    {name:'Bathurst Burr (Xanthium spinosum)', noxious:true},
    {name:'Chilean Needle Grass (Nassella neesiana)', noxious:true},
    {name:'Patterson’s Curse (Echium plantagineum)', noxious:true},
    {name:'Sweet Briar (Rosa rubiginosa)', noxious:true},
    {name:'Fleabane (Conyza spp.)', noxious:false},
    {name:'Skeleton Weed (Chondrilla juncea)', noxious:true},
    {name:'Cape Ivy (Delairea odorata)', noxious:true},
    {name:'Brooms (Cytisus scoparius etc.)', noxious:true},
    {name:'Watsonia (Watsonia spp.)', noxious:true},
    {name:'Fireweed (Senecio madagascariensis)', noxious:true}
  ];
}

const dataTools = {
  clearData(){
    if(!confirm('This clears JOBS & BATCHES (keeps inventory & weeds). Continue?')) return;
    localStorage.removeItem('wt:jobs');
    localStorage.removeItem('wt:batches');
    alert('Cleared job & batch data.');
  },
  seedDemo(){
    if((store.get('wt:jobs')||[]).length>0) return;
    const now = new Date(); const iso = d=>d.toISOString();
    const j1 = {
      id: Date.now()-100000, name:'SPOT-WombatRd-20251011-1030', councilNo:'',
      type:'Spot Spray', location:'Wombat Road',
      start: iso(new Date(now.getTime()-3600*1000)).slice(0,16),
      stop:  iso(now).slice(0,16), weed:'African Lovegrass', batchId:'101',
      notes:'Sample record', lat:-35.281, lng:149.128, photo:null,
      status:'complete', createdAt: new Date().toISOString()
    };
    const j2 = { id: Date.now()-50000, name:'INSP-CapeBroomRes-20251011-0930', councilNo:'',
      type:'Inspection', location:'Cape Broom Reserve',
      start: iso(now).slice(0,16), stop:null, weed:'Cape Broom', batchId:'',
      notes:'', lat:-33.87, lng:151.21, photo:null,
      status:'draft', createdAt:new Date().toISOString() };
    store.set('wt:jobs', [j1,j2]);

    const b1 = {
      id:'101', totalL:1600, remaining:1400,
      chems:[
        {name:'Crucial', rate:2.0, totalUsed:32},
        {name:'Sword 750 WG', rate:0.02, totalUsed:0.32},
        {name:'SuperWet', rate:0.3, totalUsed:4.8}
      ],
      jobIds:[j1.id],
      createdAt:new Date().toISOString()
    };
    store.set('wt:batches', [b1]);
  }
};
