"use server"

import { createClient } from '@/utils/supabase/server'
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {formSchema} from "@/utils/constants";
import {z} from "zod";


export async function login(formData : z.infer<typeof formSchema>) {
    const supabase = await createClient();

    const data = {
        email : formData.email as string,
        password: formData.password as string
    }

    const {error} = await supabase.auth.signInWithPassword(data);

    if (error) {
        console.log(error);
        redirect('/error');
    }
    revalidatePath("/dashboard", "layout")
    redirect("/dashboard");
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