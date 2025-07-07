import robotListData from './robotListData.json';

// 助手接口定义
export interface Robot {
    id: string;
    name: string;
    icon: string;
    group: string[];
    prompt: string;
    description: string;
}

// 工具函数
export function getRobotById(id: string): Robot | undefined {
    return robotList.find((robot) => robot.id === id);
}

export function getRobotsByGroup(group: string): Robot[] {
    return robotList.filter((robot) => robot.group.includes(group));
}

export function getAllGroups(): string[] {
    const groups = new Set<string>();
    robotList.forEach((robot) => {
        robot.group.forEach((g) => groups.add(g));
    });
    return [...groups];
}

export function searchRobots(keyword: string): Robot[] {
    const lowerKeyword = keyword.toLowerCase();
    return robotList.filter(
        (robot) =>
            robot.name.toLowerCase().includes(lowerKeyword) ||
            robot.description.toLowerCase().includes(lowerKeyword) ||
            robot.group.some((g) => g.toLowerCase().includes(lowerKeyword)),
    );
}

// 助手列表数据
export const robotList: Robot[] = robotListData.map((data) => ({
    ...data,
    group: data.group,
}));

export default robotList;
