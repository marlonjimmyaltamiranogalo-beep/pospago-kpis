export interface ExtensionDirectoryItem {
  extension: string;
  campaign: string;
  advisorName?: string;
  role?: string;
}

export const CAMPAIGN_COLORS: Record<string, {
  bg: string;
  text: string;
  border: string;
  badge: string;
  glow: string;
}> = {
  POSPAGO: {
    bg: 'bg-indigo-950/40',
    text: 'text-indigo-300',
    border: 'border-indigo-500/40',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    glow: 'shadow-indigo-500/10'
  },
  MICROSEGURO: {
    bg: 'bg-amber-950/40',
    text: 'text-amber-300',
    border: 'border-amber-500/40',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    glow: 'shadow-amber-500/10'
  },
  COBROS: {
    bg: 'bg-rose-950/40',
    text: 'text-rose-300',
    border: 'border-rose-500/40',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    glow: 'shadow-rose-500/10'
  },
  LOGISTICA: {
    bg: 'bg-emerald-950/40',
    text: 'text-emerald-300',
    border: 'border-emerald-500/40',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    glow: 'shadow-emerald-500/10'
  },
  OTRO: {
    bg: 'bg-slate-900/60',
    text: 'text-slate-300',
    border: 'border-slate-700/50',
    badge: 'bg-slate-800 text-slate-300 border-slate-700',
    glow: 'shadow-slate-500/10'
  }
};

/**
 * Official Extension, Campaign, and Advisor Directory
 */
export const EXTENSION_CAMPAIGN_DIRECTORY: Record<string, ExtensionDirectoryItem> = {
  // POSPAGO
  '5001': { extension: '5001', campaign: 'POSPAGO', advisorName: 'MIUREL' },
  '5002': { extension: '5002', campaign: 'POSPAGO', advisorName: 'JORGE' },
  '5003': { extension: '5003', campaign: 'POSPAGO', advisorName: 'CARLOS' },
  '5004': { extension: '5004', campaign: 'POSPAGO', advisorName: 'GLORIA' },
  '5005': { extension: '5005', campaign: 'POSPAGO', advisorName: 'KETHERIN' },
  '5006': { extension: '5006', campaign: 'POSPAGO', advisorName: 'ZABDY' },
  '5007': { extension: '5007', campaign: 'POSPAGO', advisorName: 'SEYDI' },
  '5008': { extension: '5008', campaign: 'POSPAGO', advisorName: '' },
  '5009': { extension: '5009', campaign: 'POSPAGO', advisorName: 'ENMANUEL' },
  '5010': { extension: '5010', campaign: 'POSPAGO', advisorName: 'FRANKLIN' },
  '5011': { extension: '5011', campaign: 'POSPAGO', advisorName: 'ESPERANZA (SUP)', role: 'SUPERVISOR' },
  '5013': { extension: '5013', campaign: 'POSPAGO', advisorName: '' },
  '5014': { extension: '5014', campaign: 'POSPAGO', advisorName: '' },
  '5015': { extension: '5015', campaign: 'POSPAGO', advisorName: 'JAHOSKA' },
  '5017': { extension: '5017', campaign: 'POSPAGO', advisorName: '' },
  '5510': { extension: '5510', campaign: 'POSPAGO', advisorName: 'BLANCA' },

  // MICROSEGURO
  '3002': { extension: '3002', campaign: 'MICROSEGURO', advisorName: '' },
  '3011': { extension: '3011', campaign: 'MICROSEGURO', advisorName: '' },
  '3012': { extension: '3012', campaign: 'MICROSEGURO', advisorName: '' },

  // COBROS
  '3001': { extension: '3001', campaign: 'COBROS', advisorName: '' },
  '3003': { extension: '3003', campaign: 'COBROS', advisorName: '' },
  '5016': { extension: '5016', campaign: 'COBROS', advisorName: '' },

  // LOGISTICA
  '3004': { extension: '3004', campaign: 'LOGISTICA', advisorName: '' },
  '3006': { extension: '3006', campaign: 'LOGISTICA', advisorName: '' },
  '5708': { extension: '5708', campaign: 'LOGISTICA', advisorName: '' },
};

export const ALL_DEFINED_CAMPAIGNS: string[] = ['POSPAGO', 'MICROSEGURO', 'COBROS', 'LOGISTICA'];

/**
 * Returns extension directory item or fallback for unknown extensions
 */
export function getExtensionInfo(extension: string): ExtensionDirectoryItem {
  if (!extension) {
    return { extension: '', campaign: 'OTRO', advisorName: '' };
  }
  const cleanExt = String(extension).trim();
  if (EXTENSION_CAMPAIGN_DIRECTORY[cleanExt]) {
    return EXTENSION_CAMPAIGN_DIRECTORY[cleanExt];
  }
  return {
    extension: cleanExt,
    campaign: 'OTRO',
    advisorName: ''
  };
}

/**
 * Returns campaign name for extension
 */
export function getExtensionCampaign(extension: string): string {
  return getExtensionInfo(extension).campaign;
}

/**
 * Returns advisor name for extension if available
 */
export function getExtensionAdvisor(extension: string): string | undefined {
  const info = getExtensionInfo(extension);
  return info.advisorName || undefined;
}

/**
 * Returns formatted label (e.g. "Ext. 5001 - MIUREL [POSPAGO]" or "Ext. 3001 [COBROS]")
 */
export function getExtensionDisplayName(extension: string): string {
  const info = getExtensionInfo(extension);
  if (info.advisorName) {
    return `Ext. ${info.extension} - ${info.advisorName}`;
  }
  if (info.campaign && info.campaign !== 'OTRO') {
    return `Ext. ${info.extension} (${info.campaign})`;
  }
  return `Ext. ${info.extension}`;
}

/**
 * Returns campaign badge styling classes
 */
export function getCampaignColorClasses(campaign: string) {
  const norm = campaign ? campaign.toUpperCase().trim() : 'OTRO';
  return CAMPAIGN_COLORS[norm] || CAMPAIGN_COLORS.OTRO;
}
