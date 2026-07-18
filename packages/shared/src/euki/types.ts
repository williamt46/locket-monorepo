export interface HealthLink {
  label: string;
  url: string;
}

export interface HealthItem {
  id: string;
  title: string;
  body: string;
  links?: HealthLink[];
}

export interface HealthSection {
  id: string;
  title: string;
  items: HealthItem[];
}

export interface HealthContent {
  sections: HealthSection[];
}
