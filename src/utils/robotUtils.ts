/**
 * 提取机器人名称的前半部分（用 - 分割）
 * @param fullName 完整的机器人名称
 * @returns 提取的前半部分名称
 */
export function getShortRobotName(fullName: string): string {
    if (!fullName) return '';

    const parts = fullName.split(' - ');
    return parts[0] || fullName;
}

/**
 * 获取机器人名称的后半部分（英文部分）
 * @param fullName 完整的机器人名称
 * @returns 提取的后半部分名称
 */
export function getRobotEnglishName(fullName: string): string {
    if (!fullName) return '';

    const parts = fullName.split(' - ');
    return parts[1] || '';
}

/**
 * 获取机器人描述的前半部分（用 - 分割）并限制字数
 * @param description 完整的机器人描述
 * @param maxLength 最大字符数，默认20
 * @returns 处理后的描述
 */
export function getShortRobotDescription(description: string, maxLength = 20): string {
    if (!description) return '';

    // 先提取 - 前的部分
    const parts = description.split(' - ');
    const shortDesc = parts[0] || description;

    // 限制字数
    if (shortDesc.length <= maxLength) {
        return shortDesc;
    }

    return `${shortDesc.slice(0, Math.max(0, maxLength))  }...`;
}
