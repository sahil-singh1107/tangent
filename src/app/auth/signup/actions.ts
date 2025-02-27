"use server"
import {createClient} from "@/utils/supabase/server";
import {redirect} from "next/navigation";
import {z} from "zod";
import {signupSchema} from "@/utils/constants";
import {v4} from "uuid";

export async function signup(formData : z.infer<typeof signupSchema>) {
    const supabase = await createClient();

    const {  error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
            emailRedirectTo: "http://localhost:3000/auth/signup"
        }
    })

    if (error) {
        return error.message;
    }
}

export async function loginGithub() {
    const supabase = await createClient();
    const { data } = await supabase.auth.signInWithOAuth({
        provider : "github",
        options: {
            redirectTo: 'http://localhost:3000/auth/callback',
        },
    })
    if (data.url) {
        redirect(data.url)
    }
}

export async function checkEmailVerified() {
    const supabase = await createClient();
    await supabase.auth.refreshSession();
    const {data } = await supabase.auth.getUser();
    if (!data || !data.user) return false;
    if (data.user?.role === "authenticated") {
        return true;
    }
    else return false;
}

export async function updateInfo(avatarUrl : string, full_name : string) {
    const supabase = await createClient();
    const {data} = await supabase.auth.getUser();
    if (!data.user) {
        return "User not found";
    }
    const avatarId = v4()
    let filePath = null;

    {

        const {data, error} = await supabase.storage.from("logos").upload(`user/${avatarId}.png`, avatarUrl);

        if (error) {
            return error.message
        }

        filePath = data.path;
    }
    await supabase.from("users").update({
        full_name,
        avatar_url: filePath
    }).eq("id", data.user.id);
    redirect("/dashboard");
}