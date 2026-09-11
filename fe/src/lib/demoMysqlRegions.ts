export type DemoRegionResolve = {
  name: string;
  matched: boolean;
};

/** docker/demo-mysql regions 表：省(1)→市(2)→区县(3) */
export type DemoMysqlRegion = {
  id: number;
  name: string;
  parentId: number | null;
  level: 1 | 2 | 3;
};

/** 与 docker/demo-mysql/tables.sql INSERT INTO regions 对齐 */
export const DEMO_MYSQL_REGIONS: DemoMysqlRegion[] = [
  { id: 5, name: "广东省", parentId: null, level: 1 },
  { id: 6, name: "江苏省", parentId: null, level: 1 },
  { id: 7, name: "北京市", parentId: null, level: 1 },
  { id: 8, name: "上海市", parentId: null, level: 1 },
  { id: 9, name: "四川省", parentId: null, level: 1 },
  { id: 10, name: "浙江省", parentId: null, level: 1 },
  { id: 11, name: "山东省", parentId: null, level: 1 },
  { id: 12, name: "河南省", parentId: null, level: 1 },
  { id: 13, name: "湖北省", parentId: null, level: 1 },
  { id: 14, name: "湖南省", parentId: null, level: 1 },
  { id: 15, name: "福建省", parentId: null, level: 1 },
  { id: 16, name: "安徽省", parentId: null, level: 1 },
  { id: 17, name: "陕西省", parentId: null, level: 1 },
  { id: 18, name: "重庆市", parentId: null, level: 1 },
  { id: 19, name: "天津市", parentId: null, level: 1 },
  { id: 20, name: "辽宁省", parentId: null, level: 1 },
  { id: 21, name: "河北省", parentId: null, level: 1 },
  { id: 22, name: "云南省", parentId: null, level: 1 },
  { id: 23, name: "贵州省", parentId: null, level: 1 },
  { id: 24, name: "江西省", parentId: null, level: 1 },
  { id: 25, name: "广西壮族自治区", parentId: null, level: 1 },
  { id: 26, name: "山西省", parentId: null, level: 1 },
  { id: 27, name: "吉林省", parentId: null, level: 1 },
  { id: 28, name: "黑龙江省", parentId: null, level: 1 },
  { id: 29, name: "甘肃省", parentId: null, level: 1 },
  { id: 30, name: "海南省", parentId: null, level: 1 },
  { id: 51, name: "广州市", parentId: 5, level: 2 },
  { id: 52, name: "深圳市", parentId: 5, level: 2 },
  { id: 61, name: "南京市", parentId: 6, level: 2 },
  { id: 71, name: "北京市", parentId: 7, level: 2 },
  { id: 81, name: "上海市", parentId: 8, level: 2 },
  { id: 91, name: "成都市", parentId: 9, level: 2 },
  { id: 101, name: "杭州市", parentId: 10, level: 2 },
  { id: 111, name: "济南市", parentId: 11, level: 2 },
  { id: 121, name: "郑州市", parentId: 12, level: 2 },
  { id: 131, name: "武汉市", parentId: 13, level: 2 },
  { id: 141, name: "长沙市", parentId: 14, level: 2 },
  { id: 151, name: "福州市", parentId: 15, level: 2 },
  { id: 161, name: "合肥市", parentId: 16, level: 2 },
  { id: 171, name: "西安市", parentId: 17, level: 2 },
  { id: 181, name: "重庆市", parentId: 18, level: 2 },
  { id: 191, name: "天津市", parentId: 19, level: 2 },
  { id: 201, name: "沈阳市", parentId: 20, level: 2 },
  { id: 211, name: "石家庄市", parentId: 21, level: 2 },
  { id: 221, name: "昆明市", parentId: 22, level: 2 },
  { id: 231, name: "贵阳市", parentId: 23, level: 2 },
  { id: 241, name: "南昌市", parentId: 24, level: 2 },
  { id: 251, name: "南宁市", parentId: 25, level: 2 },
  { id: 261, name: "太原市", parentId: 26, level: 2 },
  { id: 271, name: "长春市", parentId: 27, level: 2 },
  { id: 281, name: "哈尔滨市", parentId: 28, level: 2 },
  { id: 291, name: "兰州市", parentId: 29, level: 2 },
  { id: 301, name: "海口市", parentId: 30, level: 2 },
  { id: 511, name: "天河区", parentId: 51, level: 3 },
  { id: 512, name: "越秀区", parentId: 51, level: 3 },
  { id: 521, name: "南山区", parentId: 52, level: 3 },
  { id: 522, name: "福田区", parentId: 52, level: 3 },
  { id: 611, name: "鼓楼区", parentId: 61, level: 3 },
  { id: 612, name: "玄武区", parentId: 61, level: 3 },
  { id: 711, name: "朝阳区", parentId: 71, level: 3 },
  { id: 712, name: "海淀区", parentId: 71, level: 3 },
  { id: 811, name: "浦东新区", parentId: 81, level: 3 },
  { id: 812, name: "徐汇区", parentId: 81, level: 3 },
  { id: 911, name: "武侯区", parentId: 91, level: 3 },
  { id: 912, name: "锦江区", parentId: 91, level: 3 },
  { id: 1011, name: "西湖区", parentId: 101, level: 3 },
  { id: 1012, name: "余杭区", parentId: 101, level: 3 },
  { id: 1111, name: "历下区", parentId: 111, level: 3 },
  { id: 1211, name: "金水区", parentId: 121, level: 3 },
  { id: 1311, name: "武昌区", parentId: 131, level: 3 },
  { id: 1411, name: "芙蓉区", parentId: 141, level: 3 },
  { id: 1511, name: "鼓楼区", parentId: 151, level: 3 },
  { id: 1611, name: "包河区", parentId: 161, level: 3 },
  { id: 1711, name: "雁塔区", parentId: 171, level: 3 },
  { id: 1811, name: "渝中区", parentId: 181, level: 3 },
  { id: 1911, name: "和平区", parentId: 191, level: 3 },
  { id: 2011, name: "和平区", parentId: 201, level: 3 },
  { id: 2111, name: "长安区", parentId: 211, level: 3 },
  { id: 2211, name: "五华区", parentId: 221, level: 3 },
  { id: 2311, name: "南明区", parentId: 231, level: 3 },
  { id: 2411, name: "东湖区", parentId: 241, level: 3 },
  { id: 2511, name: "青秀区", parentId: 251, level: 3 },
  { id: 2611, name: "小店区", parentId: 261, level: 3 },
  { id: 2711, name: "南关区", parentId: 271, level: 3 },
  { id: 2811, name: "南岗区", parentId: 281, level: 3 },
  { id: 2911, name: "城关区", parentId: 291, level: 3 },
  { id: 3011, name: "龙华区", parentId: 301, level: 3 },
];

const DEMO_BY_ID = new Map(DEMO_MYSQL_REGIONS.map((r) => [r.id, r]));

function parseDemoRegionId(raw: unknown): number | null {
  const id =
    typeof raw === "number"
      ? raw
      : Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(id) ? Math.round(id) : null;
}

export function resolveDemoMysqlRegionNode(raw: unknown): DemoMysqlRegion | null {
  const id = parseDemoRegionId(raw);
  if (id == null) return null;
  return DEMO_BY_ID.get(id) ?? null;
}

/** 将演示库 region_id 上卷到当前下钻层级（0=省，1=市，2=区县） */
export function resolveDemoMysqlRegionByDrillDepth(
  raw: unknown,
  drillDepth = 0,
): DemoRegionResolve | null {
  const targetLevel = Math.min(3, Math.max(1, drillDepth + 1)) as 1 | 2 | 3;
  let node = resolveDemoMysqlRegionNode(raw);
  if (!node) return null;
  while (node.level > targetLevel && node.parentId != null) {
    const parent = DEMO_BY_ID.get(node.parentId);
    if (!parent) return null;
    node = parent;
  }
  if (node.level !== targetLevel) return null;
  return { name: node.name, matched: true };
}

export function isDemoMysqlRegionId(raw: unknown): boolean {
  return resolveDemoMysqlRegionNode(raw) != null;
}

/** 演示库 region_id：从当前节点向上收集名称（细→粗），供热力锚点逐级匹配 */
export function listDemoMysqlRegionAncestorNames(raw: unknown): string[] {
  const names: string[] = [];
  let node = resolveDemoMysqlRegionNode(raw);
  while (node) {
    names.push(node.name);
    if (node.parentId == null) break;
    node = DEMO_BY_ID.get(node.parentId) ?? null;
  }
  return names;
}
