import { FaYoutube } from "react-icons/fa";
import { AiFillTwitch } from "react-icons/ai";
import { FaDiscord } from "react-icons/fa";
import { FaGithub } from "react-icons/fa";
import { IoLogoGooglePlaystore } from "react-icons/io5";

const Footer = () => {
    return (
        <div>
            <div className="flex justify-center gap-40">
                <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                        About Dabaru.com
                    </li>
                    <li className="flex items-center gap-2">
                        <IoLogoGooglePlaystore />
                        Mobile App
                    </li>
                    <li>FAQ</li>
                    <li>Contact</li>
                </ul>
                <ul className="space-y-2">
                    <li>Release Notes</li>
                    <li>Fair Usage Policy</li>
                    <li>Privacy Policy</li>
                    <li>Terms of Use</li>
                </ul>
                <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                        <FaYoutube />
                        Youtube
                    </li>
                    <li className="flex items-center gap-2">
                        <AiFillTwitch />
                        Twitch
                    </li>
                    <li className="flex items-center gap-2">
                        <FaDiscord />
                        Discord
                    </li>
                    <li className="flex items-center gap-2">
                        <FaGithub />
                        Github
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default Footer;
