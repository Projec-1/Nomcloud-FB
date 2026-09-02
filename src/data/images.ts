// Curated, real photography used throughout the marketing site.
// Every URL points at Unsplash's own CDN (images.unsplash.com) and is used under the
// Unsplash License (free to use, no attribution required). Sizing/format params are
// appended at render time via `img()` so each usage only downloads the resolution it needs.
//
// NOTE: these are hotlinked to Unsplash's CDN — they require the visitor's browser to
// reach images.unsplash.com. If you'd rather self-host, download each photo once and
// swap the base URL for a local /public/images/... path; nothing else needs to change.

const BASE: Record<string, string> = {
  // Classrooms & students
  classroomChildren: 'https://images.unsplash.com/photo-1473649085228-583485e6e4d7',
  boyWithPaper: 'https://images.unsplash.com/photo-1536337005238-94b997371b40',
  childrenWindow: 'https://images.unsplash.com/photo-1521493959102-bdd6677fdd81',
  teacherWithLearners: '/heroteacherpicture.png',
  studentsRaisingHands: 'https://images.unsplash.com/photo-1758270704286-83476deb3bd1',
  studentsTogether: 'https://images.unsplash.com/photo-1583468982228-19f19164aee2',
  teacherTutoring: 'https://images.unsplash.com/photo-1583468991267-3f068b607ae1',
  // Technology & payments
  phoneWithCash: 'https://images.unsplash.com/photo-1533234944761-2f5337579079',
  // Security & infrastructure
  serverCables: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31',
  serverWires: 'https://images.unsplash.com/photo-1683322499436-f4383dd59f5a',
  dataCorridor: 'https://images.unsplash.com/photo-1580106815433-a5b1d1d53d85',
  serverRack: 'https://images.unsplash.com/photo-1695668548342-c0c1ad479aee',
}

export function img(key: keyof typeof BASE, width = 1200, quality = 80): string {
  const base = BASE[key]
  return `${base}?auto=format&fit=crop&w=${width}&q=${quality}`
}

export const photos = BASE
