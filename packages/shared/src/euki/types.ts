export interface EukiLink {
  label: string;
  url: string;
}

export interface EukiItem {
  id: string;
  title: string;
  body: string;
  links?: EukiLink[];
}

export interface EukiSection {
  id: string;
  title: string;
  items: EukiItem[];
}

export interface EukiContent {
  sections: EukiSection[];
}
