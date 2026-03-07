import api from "@/lib/api";
export async function getProblem(slug: string) {
    const res = await api.get(`/api/v1/problems/${slug}`);
    return res.data;
}