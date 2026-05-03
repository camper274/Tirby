import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";

type FilterValue = "All" | "None" | "Lord" | "Lieutenant" | "Warrior" | "Infantry" | "Archer" | "Cavalry" | "Unranked" | "I" | "IV" | "V";

type Option = {
  value: string;
  label: string;
};

type ApiMember = {
  id: number | string;
  name?: string | null;
  role_class?: string | null;
  unit_class?: string | null;
  rank_code?: string | null;
  settlement_id?: number | null;
  notes?: string | null;
  is_active?: number | string | null;
};

type HouseRecord = {
  id: number;
  name: string;
  slug: string;
};

type SettlementRecord = {
  id: number;
  house_id: number;
  name: string;
  type: string;
  is_active: number;
};

type Member = {
  id: number | string;
  name: string;
  class: string;
  unitClass: string | null;
  rank: string | null;
  village: string;
  notes: string | null;
  settlementType: string | null;
  isActive: number | string | null | undefined;
};

type Stats = {
  totalMembers: number;
  totalWarriors: number;
  commandStaff: number;
  highestRank: string;
};

const HOUSE_SLUG = (import.meta.env.VITE_HOUSE_SLUG as string | undefined) || "tirby";
const HOUSE_NAME = (import.meta.env.VITE_HOUSE_NAME as string | undefined) || "Tirby";

const classOptions: Option[] = [
  { value: "All", label: "Tum Siniflar" },
  { value: "Lord", label: "Lord" },
  { value: "Lieutenant", label: "Tegmen" },
  { value: "Warrior", label: "Savasci" }
];

const unitClassOptions: Option[] = [
  { value: "All", label: "Tum Birlikler" },
  { value: "None", label: "Komuta Sinifi" },
  { value: "Infantry", label: "Piyade" },
  { value: "Archer", label: "Okcu" },
  { value: "Cavalry", label: "Suvari" }
];

const villageOptions: Option[] = [
  { value: "All", label: "Tum Yerlesimler" },
  { value: "Tirby Castle", label: "Tirby Kalesi" },
  { value: "Wolfrest", label: "Wolfrest" },
  { value: "Dusk", label: "Dusk" }
];

const rankOptions: string[] = ["All", "Unranked", "I", "IV", "V"];

const classIcons: Record<string, string> = {
  lord: "LD",
  lieutenant: "LT",
  warrior: "WR"
};

const classLabelMap: Record<string, string> = {
  lord: "Lord",
  lieutenant: "Tegmen",
  warrior: "Savasci"
};

const unitClassLabelMap: Record<string, string> = {
  infantry: "Piyade",
  archer: "Okcu",
  cavalry: "Suvari"
};

const villageLabelMap: Record<string, string> = {
  "Tirby Castle": "Tirby Kalesi",
  Wolfrest: "Wolfrest",
  Dusk: "Dusk"
};

function normalizeMember(member: ApiMember): Member {
  return {
    id: member.id,
    name: member.name || "",
    class: member.role_class || "",
    unitClass: member.unit_class || null,
    rank: member.rank_code || null,
    village: "",
    notes: member.notes || null,
    settlementType: null,
    isActive: member.is_active
  };
}

function getTopRank(members: Member[]): string {
  const orderedRanks = ["V", "IV", "I"];
  const availableRanks = members.map((member) => member.rank).filter(Boolean) as string[];
  return orderedRanks.find((rank) => availableRanks.includes(rank)) || "Rutbesiz";
}

function App() {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState<string>("");
  const [memberClass, setMemberClass] = useState<FilterValue>("All");
  const [unitClass, setUnitClass] = useState<FilterValue>("All");
  const [village, setVillage] = useState<string>("All");
  const [selectedRank, setSelectedRank] = useState<FilterValue>("All");
  const [rosterStatus, setRosterStatus] = useState<string>("Tirby kayitlari yukleniyor...");

  const stats = useMemo<Stats>(() => {
    return {
      totalMembers: members.length,
      totalWarriors: members.filter((member) => member.class === "warrior").length,
      commandStaff: members.filter((member) => member.class !== "warrior").length,
      highestRank: getTopRank(members)
    };
  }, [members]);

  useEffect(() => {
    let ignore = false;

    async function fetchMembers() {
      setRosterStatus("Tirby kayitlari yukleniyor...");

      try {
        let houseResponse = await supabase
          .from("houses")
          .select("id, name, slug")
          .eq("slug", HOUSE_SLUG)
          .maybeSingle();

        let house = houseResponse.data as HouseRecord | null;
        let houseError = houseResponse.error;

        if (!house && !houseError) {
          houseResponse = await supabase
            .from("houses")
            .select("id, name, slug")
            .eq("name", HOUSE_NAME)
            .maybeSingle();

          house = houseResponse.data as HouseRecord | null;
          houseError = houseResponse.error;
        }

        if (houseError) {
          throw houseError;
        }

        if (!house) {
          throw new Error("Tirby house kaydi bulunamadi.");
        }

        const settlementsResponse = await supabase
          .from("settlements")
          .select("id, house_id, name, type, is_active")
          .eq("house_id", house.id);

        const settlements = (settlementsResponse.data as SettlementRecord[] | null) ?? [];
        const settlementsError = settlementsResponse.error;

        if (settlementsError) {
          throw settlementsError;
        }

        const settlementMap = new Map<number, SettlementRecord>(
          settlements.map((settlement) => [settlement.id, settlement])
        );

        let query = supabase
          .from("members")
          .select("id, settlement_id, name, role_class, unit_class, rank_code, is_active, notes")
          .eq("house_id", house.id)
          .order("name", { ascending: true });

        if (search.trim() !== "") {
          query = query.or(`name.ilike.%${search.trim()}%,notes.ilike.%${search.trim()}%`);
        }

        if (memberClass !== "All") {
          query = query.eq("role_class", memberClass.toLowerCase());
        }

        if (unitClass === "None") {
          query = query.is("unit_class", null);
        } else if (unitClass !== "All") {
          query = query.eq("unit_class", unitClass.toLowerCase());
        }

        if (selectedRank === "Unranked") {
          query = query.is("rank_code", null);
        } else if (selectedRank !== "All") {
          query = query.eq("rank_code", selectedRank);
        }

        if (village !== "All") {
          const selectedSettlementIds = settlements
            .filter((settlement) => settlement.name === village)
            .map((settlement) => settlement.id);

          if (selectedSettlementIds.length === 0) {
            if (!ignore) {
              setMembers([]);
              setRosterStatus("0 Tirby uyesi listeleniyor.");
            }
            return;
          }

          query = query.in("settlement_id", selectedSettlementIds);
        }

        const membersResponse = await query;
        const rows = (membersResponse.data as ApiMember[] | null) ?? [];
        const membersError = membersResponse.error;

        if (membersError) {
          throw membersError;
        }

        const normalized = rows.map((member) => {
          const baseMember = normalizeMember(member);
          const settlement = member.settlement_id ? settlementMap.get(member.settlement_id) : undefined;

          return {
            ...baseMember,
            village: settlement?.name || "",
            settlementType: settlement?.type || null
          };
        });

        if (!ignore) {
          setMembers(normalized);
          setRosterStatus(`${normalized.length} Tirby uyesi listeleniyor.`);
        }
      } catch (error) {
        if (!ignore) {
          setMembers([]);
          setRosterStatus("Veri alinamadi. Supabase baglantisini kontrol edin.");
        }
      }
    }

    fetchMembers();

    return () => {
      ignore = true;
    };
  }, [memberClass, search, selectedRank, unitClass, village]);

  function resetFilters() {
    setSearch("");
    setMemberClass("All");
    setUnitClass("All");
    setVillage("All");
    setSelectedRank("All");
  }

  return (
    <div className="page container-xxl">
      <header className="hero mb-4">
        <div className="hero-top d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-4">
          <div className="hero-copy">
            <div className="eyebrow-pill mb-3">Tirby Order Registry</div>
            <h1>Tirby Hanesi Kayitlari</h1>
            <p className="subtitle">
              Tirby Order uyeleri icin tutulan resmi kayit defteri. Bu sayfa yalnizca kardeslige bagli
              komuta siniflarini, savas duzenini ve yerlesim baglarini gosterir.
            </p>
          </div>
          <div className="crest" aria-hidden="true">TH</div>
        </div>

        <div className="hero-stats row g-3">
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat h-100">
              <span className="stat-label">Toplam Uye</span>
              <span className="stat-value">{stats.totalMembers}</span>
            </div>
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat h-100">
              <span className="stat-label">Savascilar</span>
              <span className="stat-value">{stats.totalWarriors}</span>
            </div>
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat h-100">
              <span className="stat-label">Komuta Kadrosu</span>
              <span className="stat-value">{stats.commandStaff}</span>
            </div>
          </div>
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat h-100">
              <span className="stat-label">En Yuksek Rutbe</span>
              <span className="stat-value">{stats.highestRank}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="row g-4 align-items-start">
        <aside className="col-12 col-xl-4">
          <div className="panel">
          <div className="panel-header d-flex justify-content-between align-items-center gap-3">
            <h2 className="panel-title">Hane Filtreleri</h2>
            <span className="banner-pill">Tirby</span>
          </div>

          <div className="panel-body">
            <div className="filter-stack">
              <div className="filter-block">
                <label className="filter-label" htmlFor="search">Uye Ara</label>
                <input
                  id="search"
                  className="text-input form-control"
                  type="text"
                  placeholder="Aremund, Hasuri, Yorick..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div className="filter-block">
                <label className="filter-label" htmlFor="member-class">Komuta Sinifi</label>
                <select
                  id="member-class"
                  className="select-input form-select"
                  value={memberClass}
                  onChange={(event) => setMemberClass(event.target.value as FilterValue)}
                >
                  {classOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="filter-block">
                <label className="filter-label" htmlFor="member-unit-class">Ordu Sinifi</label>
                <select
                  id="member-unit-class"
                  className="select-input form-select"
                  value={unitClass}
                  onChange={(event) => setUnitClass(event.target.value as FilterValue)}
                >
                  {unitClassOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="filter-block">
                <label className="filter-label" htmlFor="member-village">Koy</label>
                <select
                  id="member-village"
                  className="select-input form-select"
                  value={village}
                  onChange={(event) => setVillage(event.target.value)}
                >
                  {villageOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="filter-block">
                <span className="filter-label">Rutbe</span>
                <div className="tag-row">
                  {rankOptions.map((rank) => (
                    <button
                      key={rank}
                      className={`tag${selectedRank === rank ? " active" : ""}`}
                      type="button"
                      onClick={() => setSelectedRank(rank as FilterValue)}
                    >
                      {rank === "All" ? "Tum Rutbeler" : rank === "Unranked" ? "Rutbesiz" : rank}
                    </button>
                  ))}
                </div>
              </div>

              <div className="action-row row g-2">
                <div className="col-12 col-sm-6 col-xl-12 col-xxl-6">
                  <button className="btn tirby-btn w-100" type="button" onClick={resetFilters}>Tumunu Goster</button>
                </div>
                <div className="col-12 col-sm-6 col-xl-12 col-xxl-6">
                  <button className="btn tirby-btn alt w-100" type="button" onClick={resetFilters}>Sifirla</button>
                </div>
              </div>
            </div>
          </div>
          </div>
        </aside>

        <section className="col-12 col-xl-8">
          <div className="panel">
          <div className="panel-header d-flex justify-content-between align-items-center gap-3">
            <h2 className="panel-title">Uye Kayitlari</h2>
            <span className="banner-pill">Tirby Hanesi</span>
          </div>

          <div className="panel-body">
            <div className="table-tools d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
              <span className="section-kicker">Tirby Lordluğu komutasi icin duzenlenmis özel üye cetveli.</span>
              <span className="banner-pill">{members.length} gorunur</span>
            </div>

            <div className="table-wrap table-responsive">
              <table className="table align-middle mb-0 tirby-table">
                <thead>
                  <tr>
                    <th>İsim</th>
                    <th>Komuta Sınıfı</th>
                    <th>Ordu Sınıfı</th>
                    <th>Rütbe</th>
                    <th>Köy</th>
                    <th>Hane</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const unitClassLabel = member.unitClass ? unitClassLabelMap[member.unitClass] || member.unitClass : "-";
                    const rankLabel = member.rank || "Rutbesiz";
                    const icon = classIcons[member.class] || "TR";

                    return (
                      <tr key={member.id}>
                        <td>
                          <div className="unit">
                            <div className="unit-icon">{icon}</div>
                            <div>
                              <h3 className="unit-name">{member.name}</h3>
                              <p className="unit-note mb-0">Tirby Hanesi'ne baglidir</p>
                            </div>
                          </div>
                        </td>
                        <td className="faction">{classLabelMap[member.class] || member.class}</td>
                        <td>{unitClassLabel}</td>
                        <td className="tier">{rankLabel}</td>
                        <td>{villageLabelMap[member.village] || member.village}</td>
                        <td><span className="status ready">Tirby</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="footnote d-flex flex-column flex-md-row justify-content-between gap-2">
              <span>Not: Bu arayuz yalnizca Tirby duzeni icin hazirlanmistir.</span>
              <span>{rosterStatus}</span>
            </div>
          </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
