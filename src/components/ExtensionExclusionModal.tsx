import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  CheckSquare, 
  Square, 
  RotateCcw, 
  ShieldAlert, 
  Filter, 
  Users, 
  PhoneOff,
  Check,
  Ban,
  Layers,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { CDRRecord } from '../types';
import { 
  EXTENSION_CAMPAIGN_DIRECTORY, 
  ALL_DEFINED_CAMPAIGNS, 
  getExtensionInfo, 
  getCampaignColorClasses 
} from '../data/campaignDirectory';

interface ExtensionExclusionModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableExtensions: string[];
  excludedExtensions: string[];
  onToggleExclude: (ext: string) => void;
  onSetExcluded: (exts: string[]) => void;
  onClearExcluded: () => void;
  cdrRecords: CDRRecord[];
}

export const ExtensionExclusionModal: React.FC<ExtensionExclusionModalProps> = ({
  isOpen,
  onClose,
  availableExtensions,
  excludedExtensions,
  onToggleExclude,
  onSetExcluded,
  onClearExcluded,
  cdrRecords
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampaignTab, setSelectedCampaignTab] = useState<string>('all');

  // Combine available extensions with all known directory extensions to make sure any campaign extension can be excluded/managed
  const allKnownAndAvailableExtensions = useMemo(() => {
    const set = new Set<string>(availableExtensions);
    Object.keys(EXTENSION_CAMPAIGN_DIRECTORY).forEach(ext => set.add(ext));
    const list = Array.from(set);
    list.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return list;
  }, [availableExtensions]);

  // Calculate call volume per extension
  const extensionCounts = useMemo(() => {
    const map = new Map<string, { total: number; outgoing: number; incoming: number }>();
    cdrRecords.forEach(r => {
      const ext = r.agentExtension || r.from || r.to;
      if (!ext) return;
      const curr = map.get(ext) || { total: 0, outgoing: 0, incoming: 0 };
      curr.total++;
      if (r.callType === 'Outgoing') curr.outgoing++;
      if (r.callType === 'Incoming') curr.incoming++;
      map.set(ext, curr);
    });
    return map;
  }, [cdrRecords]);

  // Campaign count stats
  const campaignCounts = useMemo(() => {
    const counts: Record<string, { total: number; excluded: number }> = {
      all: { total: allKnownAndAvailableExtensions.length, excluded: excludedExtensions.length },
      POSPAGO: { total: 0, excluded: 0 },
      MICROSEGURO: { total: 0, excluded: 0 },
      COBROS: { total: 0, excluded: 0 },
      LOGISTICA: { total: 0, excluded: 0 },
      OTRO: { total: 0, excluded: 0 }
    };

    allKnownAndAvailableExtensions.forEach(ext => {
      const info = getExtensionInfo(ext);
      const camp = ALL_DEFINED_CAMPAIGNS.includes(info.campaign) ? info.campaign : 'OTRO';
      if (!counts[camp]) counts[camp] = { total: 0, excluded: 0 };
      counts[camp].total++;
      if (excludedExtensions.includes(ext)) {
        counts[camp].excluded++;
      }
    });

    return counts;
  }, [allKnownAndAvailableExtensions, excludedExtensions]);

  // Filtered list based on search and selected campaign
  const filteredExtensions = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return allKnownAndAvailableExtensions.filter(ext => {
      const info = getExtensionInfo(ext);
      
      // Campaign tab filter
      if (selectedCampaignTab !== 'all') {
        const camp = ALL_DEFINED_CAMPAIGNS.includes(info.campaign) ? info.campaign : 'OTRO';
        if (camp !== selectedCampaignTab) return false;
      }

      // Search term
      if (!term) return true;
      const matchExt = ext.toLowerCase().includes(term);
      const matchAdvisor = info.advisorName ? info.advisorName.toLowerCase().includes(term) : false;
      const matchCampaign = info.campaign ? info.campaign.toLowerCase().includes(term) : false;
      return matchExt || matchAdvisor || matchCampaign;
    });
  }, [allKnownAndAvailableExtensions, searchTerm, selectedCampaignTab]);

  // Quick exclusion per entire campaign
  const handleToggleCampaignExclusion = (campaignName: string) => {
    const campaignExts = allKnownAndAvailableExtensions.filter(e => {
      const info = getExtensionInfo(e);
      const camp = ALL_DEFINED_CAMPAIGNS.includes(info.campaign) ? info.campaign : 'OTRO';
      return camp === campaignName;
    });

    const allAreExcluded = campaignExts.every(e => excludedExtensions.includes(e));

    if (allAreExcluded) {
      // Re-include all in this campaign
      onSetExcluded(excludedExtensions.filter(e => !campaignExts.includes(e)));
    } else {
      // Exclude all in this campaign
      onSetExcluded(Array.from(new Set([...excludedExtensions, ...campaignExts])));
    }
  };

  // Quick exclusion presets
  const handleExcludeHighPrefix = () => {
    // Exclude extensions >= 5500 (supervisors / special)
    const toExclude = allKnownAndAvailableExtensions.filter(e => {
      const num = parseInt(e, 10);
      return !isNaN(num) && num >= 5500;
    });
    onSetExcluded(Array.from(new Set([...excludedExtensions, ...toExclude])));
  };

  const handleExcludeLowVolume = () => {
    // Exclude extensions with less than 5 calls
    const toExclude = allKnownAndAvailableExtensions.filter(e => {
      const stats = extensionCounts.get(e);
      return !stats || stats.total <= 3;
    });
    onSetExcluded(Array.from(new Set([...excludedExtensions, ...toExclude])));
  };

  const handleToggleAllVisible = () => {
    const allFilteredAreExcluded = filteredExtensions.length > 0 && filteredExtensions.every(e => excludedExtensions.includes(e));
    if (allFilteredAreExcluded) {
      // Unexclude all visible
      onSetExcluded(excludedExtensions.filter(e => !filteredExtensions.includes(e)));
    } else {
      // Exclude all visible
      onSetExcluded(Array.from(new Set([...excludedExtensions, ...filteredExtensions])));
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      id="modal-exclude-extensions"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="bg-[#131317] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-[#0d0d10] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Exclusión de Extensiones y Campañas</span>
                {excludedExtensions.length > 0 && (
                  <span className="bg-rose-500/20 text-rose-400 text-xs px-2.5 py-0.5 rounded-full font-mono border border-rose-500/30">
                    {excludedExtensions.length} excluidas
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Filtra por campaña (POSPAGO, MICROSEGURO, COBROS, LOGISTICA) o por asesor para omitir extensiones en las métricas.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Campaign Selector Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Filtrar por Campaña:</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Selecciona una pestaña para ver o excluir una campaña completa
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-[#0a0a0c] p-1.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedCampaignTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedCampaignTab === 'all'
                    ? 'bg-slate-800 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <span>Todas</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900 text-slate-300 font-mono">
                  {campaignCounts.all?.total || 0}
                </span>
              </button>

              {ALL_DEFINED_CAMPAIGNS.map(camp => {
                const colors = getCampaignColorClasses(camp);
                const stats = campaignCounts[camp] || { total: 0, excluded: 0 };
                const isSelected = selectedCampaignTab === camp;
                const isEntirelyExcluded = stats.total > 0 && stats.excluded === stats.total;

                return (
                  <button
                    key={camp}
                    type="button"
                    onClick={() => setSelectedCampaignTab(camp)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? `${colors.bg} ${colors.text} ${colors.border} border font-bold shadow-sm`
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <span>{camp}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isEntirelyExcluded ? 'bg-rose-900/60 text-rose-300 font-bold' : 'bg-slate-900/80 text-slate-300'
                    }`}>
                      {stats.excluded > 0 ? `${stats.excluded}/${stats.total}` : stats.total}
                    </span>
                  </button>
                );
              })}

              {campaignCounts.OTRO?.total > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCampaignTab('OTRO')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedCampaignTab === 'OTRO'
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Otras</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900 text-slate-300 font-mono">
                    {campaignCounts.OTRO.total}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Campaign Action Bar */}
          <div className="bg-[#16161a] border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-semibold text-[11px] mr-1">Acción Rápida por Campaña:</span>
              {ALL_DEFINED_CAMPAIGNS.map(camp => {
                const stats = campaignCounts[camp] || { total: 0, excluded: 0 };
                const isEntirelyExcluded = stats.total > 0 && stats.excluded === stats.total;
                const colors = getCampaignColorClasses(camp);

                return (
                  <button
                    key={`btn-toggle-camp-${camp}`}
                    type="button"
                    onClick={() => handleToggleCampaignExclusion(camp)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1.5 cursor-pointer ${
                      isEntirelyExcluded
                        ? 'bg-rose-950/60 text-rose-300 border-rose-600/70 hover:bg-rose-900/80'
                        : `${colors.bg} ${colors.text} ${colors.border} hover:opacity-90`
                    }`}
                    title={isEntirelyExcluded ? `Re-incluir toda la campaña ${camp}` : `Excluir toda la campaña ${camp}`}
                  >
                    <span>{isEntirelyExcluded ? `Re-incluir ${camp}` : `Excluir ${camp}`}</span>
                    {stats.excluded > 0 && (
                      <span className="text-[9px] px-1 rounded-full bg-black/40 font-mono">
                        {stats.excluded}/{stats.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {excludedExtensions.length > 0 && (
              <button
                type="button"
                onClick={onClearExcluded}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] transition-colors flex items-center gap-1 cursor-pointer ml-auto"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer Todo</span>
              </button>
            )}
          </div>

          {/* Search Bar & Quick Toggles */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por extensión (5001), asesor (Miurel) o campaña (Pospago)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#1a1a20] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={handleToggleAllVisible}
              className="px-3 py-2 rounded-lg bg-[#1a1a20] hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>{filteredExtensions.length > 0 && filteredExtensions.every(e => excludedExtensions.includes(e)) ? 'Incluir Visibles' : 'Excluir Visibles'}</span>
            </button>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-slate-500 font-semibold">Otros filtros:</span>
            <button
              type="button"
              onClick={handleExcludeHighPrefix}
              className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition-colors cursor-pointer"
            >
              Excluir Supervisores (≥5500)
            </button>
            <button
              type="button"
              onClick={handleExcludeLowVolume}
              className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition-colors cursor-pointer"
            >
              Excluir Bajo Volumen (≤3 llamadas)
            </button>
          </div>

          {/* Active Excluded Chips */}
          {excludedExtensions.length > 0 && (
            <div className="bg-rose-950/20 border border-rose-800/30 rounded-xl p-3">
              <span className="text-[11px] font-bold text-rose-400 block mb-2">
                Extensiones Excluidas ({excludedExtensions.length}):
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {excludedExtensions.map(ext => {
                  const info = getExtensionInfo(ext);
                  const colors = getCampaignColorClasses(info.campaign);

                  return (
                    <span
                      key={ext}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-900/40 text-rose-200 border border-rose-700/50 text-[11px] font-medium"
                    >
                      <span className="font-mono font-bold">Ext. {ext}</span>
                      {info.advisorName && (
                        <span className="text-white font-semibold">({info.advisorName})</span>
                      )}
                      <span className={`text-[9px] px-1 py-0.2 rounded border font-mono font-bold ${colors.badge}`}>
                        {info.campaign}
                      </span>
                      <button
                        type="button"
                        onClick={() => onToggleExclude(ext)}
                        className="hover:text-white text-rose-400 p-0.5 rounded transition-colors cursor-pointer"
                        title="Quitar exclusión"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Extensions Checklist Grid */}
          <div className="border border-slate-800 rounded-xl bg-[#0d0d10] p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2 px-1">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  Listado de Extensiones ({filteredExtensions.length}
                  {selectedCampaignTab !== 'all' ? ` en ${selectedCampaignTab}` : ''})
                </span>
              </span>
              <span className="text-[11px] text-slate-500">Haz clic en una casilla para excluir / activar</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {filteredExtensions.map(ext => {
                const isExcluded = excludedExtensions.includes(ext);
                const info = getExtensionInfo(ext);
                const colors = getCampaignColorClasses(info.campaign);
                const stats = extensionCounts.get(ext) || { total: 0, outgoing: 0, incoming: 0 };

                return (
                  <div
                    key={ext}
                    onClick={() => onToggleExclude(ext)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all select-none ${
                      isExcluded 
                        ? 'bg-rose-950/20 border-rose-800/40 text-rose-300' 
                        : 'bg-[#16161a] border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-[#1a1a20]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] shrink-0 ${
                        isExcluded 
                          ? 'bg-rose-600 border-rose-500 text-white font-bold' 
                          : 'border-slate-600 bg-transparent text-transparent'
                      }`}>
                        {isExcluded ? '✕' : ''}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-mono text-xs font-bold ${isExcluded ? 'text-rose-400 line-through' : 'text-white'}`}>
                            Ext. {ext}
                          </span>
                          {info.advisorName ? (
                            <span className={`text-xs font-semibold truncate ${isExcluded ? 'text-rose-300/80 line-through' : 'text-indigo-200'}`}>
                              {info.advisorName}
                            </span>
                          ) : null}
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase border ${colors.badge}`}>
                            {info.campaign}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 truncate">
                          {stats.total > 0 ? (
                            `${stats.total} llamadas (${stats.outgoing} salientes, ${stats.incoming} entrantes)`
                          ) : (
                            'Directorio / Sin llamadas en el rango'
                          )}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase shrink-0 ${
                      isExcluded ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {isExcluded ? 'Excluida' : 'Activa'}
                    </span>
                  </div>
                );
              })}

              {filteredExtensions.length === 0 && (
                <div className="col-span-2 py-8 text-center text-xs text-slate-500">
                  No se encontraron extensiones que coincidan con la búsqueda o filtro de campaña.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#0d0d10] flex items-center justify-between">
          <div className="text-xs text-slate-400 font-medium">
            {excludedExtensions.length === 0 ? (
              <span className="text-slate-500">Todas las extensiones están activas</span>
            ) : (
              <span className="text-rose-400 font-semibold">
                {excludedExtensions.length} extensiones excluidas de los cálculos
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
          >
            Aplicar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
